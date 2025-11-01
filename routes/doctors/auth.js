import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import jwt from 'jsonwebtoken';

const router = Router();

// Register doctor (dev-friendly; replace with proper auth later)
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, phone, licenseNumber, yearsOfExperience, specialties = [], address } = req.body;
        if (!name || (!email && !phone)) {
            return res.status(400).json({ error: 'name and either email or phone are required' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
                data: {
                    role: 'DOCTOR',
                    name,
                    email,
                    phone,
                    doctor: {
                        create: {
                            licenseNumber,
                            yearsOfExperience,
                            specialties,
                            isActive: true,
                            // Optionally initialize location from address if provided
                            currentLocationLat: address?.latitude ?? undefined,
                            currentLocationLng: address?.longitude ?? undefined,
                        },
                    },
                },
                include: { doctor: true },
            });

            if (address?.line1 && address?.city && address?.state && address?.postalCode && address?.country) {
                const addr = await tx.address.create({
                    data: {
                        line1: address.line1,
                        line2: address.line2 ?? null,
                        city: address.city,
                        state: address.state,
                        postalCode: address.postalCode,
                        country: address.country,
                        latitude: address.latitude ?? null,
                        longitude: address.longitude ?? null,
                    },
                });
                await tx.userAddress.create({
                    data: { userId: createdUser.id, addressId: addr.id, isPrimary: true },
                });
            }

            return createdUser;
        });

    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const expiresIn = process.env.JWT_EXPIRES || '7d';
    const token = jwt.sign({ sub: result.id, role: 'DOCTOR' }, secret, { expiresIn });
    res.status(201).json({ token, user: result });
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'User with this email/phone already exists' });
        }
        next(err);
    }
});

// Login doctor (dev-only; token = user.id)
router.post('/login', async (req, res, next) => {
    try {
        const { email, phone } = req.body;
        if (!email && !phone) return res.status(400).json({ error: 'email or phone is required' });

        const user = await prisma.user.findFirst({
            where: {
                role: 'DOCTOR',
                OR: [{ email: email || undefined }, { phone: phone || undefined }],
            },
            include: { doctor: true },
        });
        if (!user) return res.status(404).json({ error: 'Doctor not found' });

    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const expiresIn = process.env.JWT_EXPIRES || '7d';
    const token = jwt.sign({ sub: user.id, role: 'DOCTOR' }, secret, { expiresIn });
    res.json({ token, user });
    } catch (err) {
        next(err);
    }
});

export default router;
