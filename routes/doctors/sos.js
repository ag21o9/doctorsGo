import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import { attachUser, requireRole } from '../../middlewares/auth.js';

const router = Router();
router.use(attachUser(false), requireRole(['DOCTOR']));

// List invitations for this doctor
router.get('/invitations', async (req, res, next) => {
  try {
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
    const invites = await prisma.sOSInvitation.findMany({
      where: { doctorId: doctor.id, status: { in: ['INVITED', 'QUEUED'] } },
      orderBy: { sentAt: 'desc' },
      include: { sos: true },
    });
    res.json(invites);
  } catch (err) {
    next(err);
  }
});

// Accept SOS (first-come, first-served)
router.post('/:sosId/accept', async (req, res, next) => {
  const { sosId } = req.params;
  try {
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });

    const result = await prisma.$transaction(async (tx) => {
      const sos = await tx.sOSRequest.findUnique({ where: { id: sosId }, include: { invitations: true } });
      if (!sos) throw Object.assign(new Error('SOS not found'), { status: 404 });
      if (sos.status !== 'PENDING') throw Object.assign(new Error('SOS not pending'), { status: 409 });
      if (sos.acceptedById) throw Object.assign(new Error('SOS already accepted'), { status: 409 });

      // Mark accepted by this doctor
      const updated = await tx.sOSRequest.update({
        where: { id: sosId },
        data: { status: 'ACCEPTED', acceptedById: doctor.id },
      });

      // Update invitation status
      await tx.sOSInvitation.updateMany({
        where: { sosId, doctorId: doctor.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });

      return updated;
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
