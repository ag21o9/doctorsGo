import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import { attachUser, requireRole } from '../../middlewares/auth.js';

const router = Router();
router.use(attachUser(false), requireRole(['DOCTOR']));

// Upsert services (array)
// Body: { services: [{ specialty, basePrice, perKmRate, isOnlineAvailable, isHomeVisitAvailable, description }] }
router.patch('/', async (req, res, next) => {
  try {
    const { services } = req.body;
    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: 'services array is required' });
    }
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
    if (!doctor) return res.status(404).json({ error: 'Doctor profile not found' });

    const ops = services.map((s) =>
      prisma.doctorService.upsert({
        where: { doctorId_specialty: { doctorId: doctor.id, specialty: s.specialty } },
        create: {
          doctorId: doctor.id,
          specialty: s.specialty,
          basePrice: s.basePrice,
          perKmRate: s.perKmRate ?? 15,
          isOnlineAvailable: s.isOnlineAvailable ?? true,
          isHomeVisitAvailable: s.isHomeVisitAvailable ?? true,
          description: s.description ?? null,
        },
        update: {
          basePrice: s.basePrice ?? undefined,
          perKmRate: s.perKmRate ?? undefined,
          isOnlineAvailable: s.isOnlineAvailable ?? undefined,
          isHomeVisitAvailable: s.isHomeVisitAvailable ?? undefined,
          description: s.description ?? undefined,
        },
      })
    );

    const results = await prisma.$transaction(ops);
    res.json({ services: results });
  } catch (err) {
    next(err);
  }
});

export default router;
