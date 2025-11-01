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
      include: { doctor: true },
    });
    res.json(me);
  } catch (err) {
    next(err);
  }
});

router.patch('/me', async (req, res, next) => {
  try {
    const { name, licenseNumber, yearsOfExperience, specialties, isActive } = req.body;
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
