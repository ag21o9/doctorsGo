import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import { attachUser, requireRole } from '../../middlewares/auth.js';

const router = Router();
router.use(attachUser(false), requireRole(['PATIENT']));

// Get my profile
router.get('/me', async (req, res, next) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        patient: true,
        addresses: { include: { address: true } },
      },
    });
    res.json(me);
  } catch (err) {
    next(err);
  }
});

// Update basic profile
router.patch('/me', async (req, res, next) => {
  try {
    const { name, gender, bloodType, dateOfBirth } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name,
        gender,
        bloodType,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      },
      include: { patient: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Update or set primary address for patient
router.patch('/me/address', async (req, res, next) => {
  try {
    const { line1, line2, city, state, postalCode, country, latitude, longitude } = req.body;
    if (!line1 || !city || !state || !postalCode || !country) {
      return res.status(400).json({ error: 'line1, city, state, postalCode, country are required' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.userAddress.updateMany({ where: { userId: req.user.id, isPrimary: true }, data: { isPrimary: false } });

      const addr = await tx.address.create({
        data: { line1, line2: line2 ?? null, city, state, postalCode, country, latitude: latitude ?? null, longitude: longitude ?? null },
      });

      await tx.userAddress.create({ data: { userId: req.user.id, addressId: addr.id, isPrimary: true } });
      return addr;
    });

    res.json({ address: updated, message: 'Primary address updated' });
  } catch (err) {
    next(err);
  }
});

export default router;
