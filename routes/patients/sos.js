import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import { attachUser, requireRole } from '../../middlewares/auth.js';

const router = Router();
router.use(attachUser(false), requireRole(['PATIENT']));

router.post('/', async (req, res, next) => {
  try {

    // AI MODEL IMPLEMENTATION

    const { description, specialty, latitude, longitude, initialRadiusKm = 5 } = req.body;
    if (!description || !specialty || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'description, specialty, latitude, longitude are required' });
    }

    const sos = await prisma.sOSRequest.create({
      data: {
        patientId: req.user.patient.id,
        description,
        specialty,
        status: 'PENDING',
        latitude,
        longitude,
        initialRadiusKm,
        currentRadiusKm: initialRadiusKm,
      },
    });

    res.status(201).json(sos);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const sos = await prisma.sOSRequest.findMany({
      where: { patientId: req.user.patient.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sos);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const updated = await prisma.sOSRequest.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
