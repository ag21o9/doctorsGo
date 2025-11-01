import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import { attachUser, requireRole } from '../../middlewares/auth.js';
import { aiGenerateAppointmentReport } from '../../configs/ai.js';

const router = Router();
router.use(attachUser(false), requireRole(['DOCTOR']));

// Close appointment and attach report, compute total pricing
// Body: { appointmentId, report: { diagnosis, summary, recommendations, equipmentRequired }, basePrice, distanceKm }
router.post('/close', async (req, res, next) => {
  try {
    const { appointmentId, report, basePrice, distanceKm, autoGenerate } = req.body;
    if (!appointmentId) return res.status(400).json({ error: 'appointmentId is required' });

    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
    if (!doctor) return res.status(404).json({ error: 'Doctor profile not found' });

  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    // Pricing formula from spec:
    // total = basePrice + (perKm * km) + 18% of (base + transport)'s 20% money
    // Interpretation used:
    // transport = perKm * km (use doctor service perKmRate if available, else 15)
    // subtotal = basePrice + transport
    // gst = subtotal * 0.18
    // platformFee = subtotal * 0.20
    // total = subtotal + gst + platformFee

    let perKm = 15;
    const svc = await prisma.doctorService.findFirst({ where: { doctorId: doctor.id, specialty: appt.specialty } });
    if (svc) perKm = Number(svc.perKmRate);

    const base = Number(basePrice ?? (svc ? svc.basePrice : 0));
    const km = Number(distanceKm ?? 0);
    const transport = perKm * km;
    const subtotal = base + transport;
    const gst = subtotal * 0.18;
    const platformFee = subtotal * 0.20;
    const total = Number((subtotal + gst + platformFee).toFixed(2));

    // Possibly generate a report via AI if requested or missing fields
    let finalReport = report || {};
    if (autoGenerate || !report) {
      const generated = await aiGenerateAppointmentReport({ description: appt.description, specialty: appt.specialty });
      finalReport = { ...generated, ...finalReport };
    }

    const result = await prisma.$transaction(async (tx) => {
      // upsert report
      await tx.appointmentReport.upsert({
        where: { appointmentId },
        create: {
          appointmentId,
          diagnosis: finalReport?.diagnosis ?? null,
          summary: finalReport?.summary ?? null,
          recommendations: finalReport?.recommendations ?? null,
          equipmentRequired: finalReport?.equipmentRequired ?? null,
        },
        update: {
          diagnosis: finalReport?.diagnosis ?? undefined,
          summary: finalReport?.summary ?? undefined,
          recommendations: finalReport?.recommendations ?? undefined,
          equipmentRequired: finalReport?.equipmentRequired ?? undefined,
        },
      });

      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'COMPLETED', closedAt: new Date(), total },
      });

      return updated;
    });

    res.json({ appointment: result, pricing: { base, perKm, km, transport, gst, platformFee, total } });
  } catch (err) {
    next(err);
  }
});

export default router;
