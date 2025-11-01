import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import { attachUser, requireRole } from '../../middlewares/auth.js';

const router = Router();
router.use(attachUser(false), requireRole(['DOCTOR']));

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

// Discover pending appointment requests for this doctor by specialty and distance
router.get('/requests', async (req, res, next) => {
  try {
    const { lat, lng, radiusKm = 5 } = req.query;
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
    if (!doctor) return res.status(404).json({ error: 'Doctor profile not found' });

    const appts = await prisma.appointment.findMany({
      where: {
        status: 'PENDING',
        specialty: { in: doctor.specialties },
      },
      include: { address: true },
      orderBy: { createdAt: 'desc' },
    });

    let originLat = doctor.currentLocationLat;
    let originLng = doctor.currentLocationLng;
    if (lat != null && lng != null) {
      originLat = parseFloat(lat);
      originLng = parseFloat(lng);
    }

    const RAD = parseFloat(radiusKm);
    const results = [];
    for (const a of appts) {
      const alat = a.address?.latitude;
      const alng = a.address?.longitude;
      if (originLat == null || originLng == null || alat == null || alng == null) {
        // include requests without location if doctor opts to see them
        continue;
      }
      const dist = haversineKm(originLat, originLng, alat, alng);
      if (dist <= RAD) results.push({ ...a, distanceKm: Number(dist.toFixed(2)) });
    }

    res.json(results);
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

// Update appointment status (e.g., start/finish meet)
router.patch('/:appointmentId/status', async (req, res, next) => {
  const { appointmentId } = req.params;
  const { status } = req.body; // IN_PROGRESS | COMPLETED | CANCELLED | CONFIRMED
  try {
    const allowed = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CONFIRMED'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'invalid status' });
    const updated = await prisma.appointment.update({ where: { id: appointmentId }, data: { status } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
