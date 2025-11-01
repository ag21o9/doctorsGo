import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import { attachUser, requireRole } from '../../middlewares/auth.js';

const router = Router();
router.use(attachUser(false), requireRole(['DOCTOR']));

// List doctor assignments with appointment details
router.get('/', async (req, res, next) => {
  try {
    const assignments = await prisma.appointmentAssignment.findMany({
      where: { doctor: { userId: req.user.id } },
      include: { appointment: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(assignments);
  } catch (err) {
    next(err);
  }
});

// Accept an appointment (queue with max 2 accepted)
router.post('/:appointmentId/accept', async (req, res, next) => {
  const { appointmentId } = req.params;
  try {
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    // Count accepted
    const accepted = await prisma.appointmentAssignment.count({
      where: { appointmentId, status: 'ACCEPTED' },
    });

    if (accepted >= 2) {
      return res.status(409).json({ error: 'Appointment already has two doctors assigned' });
    }

    // Ensure unique per appointment/doctor
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
    if (!doctor) return res.status(404).json({ error: 'Doctor profile not found' });

    const existing = await prisma.appointmentAssignment.findUnique({
      where: { appointmentId_doctorId: { appointmentId, doctorId: doctor.id } },
    });
    if (existing) return res.json(existing);

    const queuePosition = accepted + 1; // 1 or 2
    const created = await prisma.appointmentAssignment.create({
      data: {
        appointmentId,
        doctorId: doctor.id,
        status: 'ACCEPTED',
        queuePosition,
        acceptedAt: new Date(),
      },
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// Cancel assignment; simplistic promotion not implemented in this snippet
router.post('/:appointmentId/cancel', async (req, res, next) => {
  const { appointmentId } = req.params;
  try {
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
    const updated = await prisma.appointmentAssignment.update({
      where: { appointmentId_doctorId: { appointmentId, doctorId: doctor.id } },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
