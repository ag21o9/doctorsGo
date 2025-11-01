import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';

const router = Router();

// Register doctor (dev-friendly; replace with proper auth later)
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, phone, licenseNumber, yearsOfExperience, specialties = [] } = req.body;
    if (!name || (!email && !phone)) {
      return res.status(400).json({ error: 'name and either email or phone are required' });
    }

    const user = await prisma.user.create({
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
          },
        },
      },
      include: { doctor: true },
    });

    // Dev token = user.id
    res.status(201).json({ token: user.id, user });
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

    res.json({ token: user.id, user });
  } catch (err) {
    next(err);
  }
});

export default router;
