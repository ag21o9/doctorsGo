import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import { attachUser, requireRole } from '../../middlewares/auth.js';

const router = Router();
router.use(attachUser(false), requireRole(['PATIENT']));

// Basic health status summary for patient
router.get('/status', async (req, res, next) => {
  try {
    const patientId = req.user.patient.id;
    const appointments = await prisma.appointment.findMany({
      where: { patientId, status: { in: ['COMPLETED', 'CONFIRMED', 'IN_PROGRESS'] } },
      include: { report: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const bySpecialty = {};
    let lastReport = null;
    for (const a of appointments) {
      bySpecialty[a.specialty] = (bySpecialty[a.specialty] || 0) + 1;
      if (!lastReport && a.report) lastReport = a.report;
    }

    res.json({
      countsBySpecialty: bySpecialty,
      lastReport: lastReport ? {
        diagnosis: lastReport.diagnosis,
        summary: lastReport.summary,
        recommendations: lastReport.recommendations,
      } : null,
      totalVisits: appointments.length,
    });
  } catch (err) {
    next(err);
  }
});

// Get a specific appointment report
router.get('/appointments/:id/report', async (req, res, next) => {
  try {
    const a = await prisma.appointment.findFirst({
      where: { id: req.params.id, patientId: req.user.patient.id },
      include: { report: true },
    });
    if (!a) return res.status(404).json({ error: 'Appointment not found' });
    res.json(a.report || {});
  } catch (err) {
    next(err);
  }
});

export default router;
