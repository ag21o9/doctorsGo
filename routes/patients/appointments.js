import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import { attachUser, requireRole } from '../../middlewares/auth.js';

const router = Router();
router.use(attachUser(false), requireRole(['PATIENT']));

// Create appointment
router.post('/', async (req, res, next) => {
  try {
    const { type, mode, specialty, description, toolsRequired, meetLink, scheduledAt, addressId, isEmergency } = req.body;
    if (!type || !mode || !specialty || !description) {
      return res.status(400).json({ error: 'type, mode, specialty, description are required' });
    }

    const created = await prisma.appointment.create({
      data: {
        patient: { connect: { id: req.user.patient.id } },
        type,
        mode,
        specialty,
        description,
        toolsRequired,
        meetLink,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        address: addressId ? { connect: { id: addressId } } : undefined,
        isEmergency: !!isEmergency,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.appointment.findMany({
      where: { patientId: req.user.patient.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
