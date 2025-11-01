import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import { attachUser, requireRole } from '../../middlewares/auth.js';

const router = Router();

// All routes require doctor role
router.use(attachUser(false), requireRole(['DOCTOR']));

router.get('/me', async (req, res, next) => {
    try {
        const me = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { doctor: true, addresses: { include: { address: true } } },
        });
        res.json(me);
    } catch (err) {
        next(err);
    }
});

router.patch('/me', async (req, res, next) => {
    try {
        const { name, licenseNumber, yearsOfExperience, specialties, isActive, bio } = req.body;
        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                name,
                doctor: {
                    update: {
                        licenseNumber,
                        yearsOfExperience,
                        specialties,
                        isActive,
                        bio,
                    },
                },
            },
            include: { doctor: true },
        });
        res.json(updated);
    } catch (err) {
        next(err);
    }
});

router.patch('/location', async (req, res, next) => {
    try {
        const { lat, lng, serviceRadiusKm } = req.body;
        const updated = await prisma.doctor.update({
            where: { userId: req.user.id },
            data: {
                currentLocationLat: lat,
                currentLocationLng: lng,
                serviceRadiusKm,
            },
        });
        res.json(updated);
    } catch (err) {
        next(err);
    }
});

export default router;

// Update or set primary address for doctor under profile
router.patch('/me/address', async (req, res, next) => {
    try {
        const { line1, line2, city, state, postalCode, country, latitude, longitude } = req.body;
        if (!line1 || !city || !state || !postalCode || !country) {
            return res.status(400).json({ error: 'line1, city, state, postalCode, country are required' });
        }

        const updated = await prisma.$transaction(async (tx) => {
            // Unset previous primary
            await tx.userAddress.updateMany({ where: { userId: req.user.id, isPrimary: true }, data: { isPrimary: false } });

            const addr = await tx.address.create({
                data: { line1, line2: line2 ?? null, city, state, postalCode, country, latitude: latitude ?? null, longitude: longitude ?? null },
            });

            await tx.userAddress.create({ data: { userId: req.user.id, addressId: addr.id, isPrimary: true } });

            // Optionally update currentLocation from provided lat/lng
            if (latitude != null && longitude != null) {
                await tx.doctor.update({ where: { userId: req.user.id }, data: { currentLocationLat: latitude, currentLocationLng: longitude } });
            }

            return addr;
        });

        res.json({ address: updated, message: 'Primary address updated' });
    } catch (err) {
        next(err);
    }
});
