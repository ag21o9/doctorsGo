import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, phone, gender, bloodType, dateOfBirth } = req.body;
    if (!name || (!email && !phone)) {
      return res.status(400).json({ error: 'name and either email or phone are required' });
    }

    const user = await prisma.user.create({
      data: {
        role: 'PATIENT',
        name,
        email,
        phone,
        gender,
        bloodType,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        patient: { create: {} },
      },
      include: { patient: true },
    });

    res.status(201).json({ token: user.id, user });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'User with this email/phone already exists' });
    }
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, phone } = req.body;
    if (!email && !phone) return res.status(400).json({ error: 'email or phone is required' });

    const user = await prisma.user.findFirst({
      where: {
        role: 'PATIENT',
        OR: [{ email: email || undefined }, { phone: phone || undefined }],
      },
      include: { patient: true },
    });
    if (!user) return res.status(404).json({ error: 'Patient not found' });

    res.json({ token: user.id, user });
  } catch (err) {
    next(err);
  }
});

export default router;
