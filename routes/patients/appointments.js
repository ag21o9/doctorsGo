import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import { attachUser, requireRole } from '../../middlewares/auth.js';
import { aiClassifySpecialty } from '../../configs/ai.js';

const router = Router();
router.use(attachUser(false), requireRole(['PATIENT']));

// Create appointment
router.post('/', async (req, res, next) => {
    try {
        const { type, mode, specialty, description, toolsRequired, meetLink, scheduledAt, addressId, isEmergency, doctorId } = req.body;
        if (!type || !mode || !description) {
            return res.status(400).json({ error: 'type, mode, description are required' });
        }

        let finalSpecialty = specialty;
        if (!finalSpecialty) {
            const triage = await aiClassifySpecialty(description);
            finalSpecialty = triage.specialty;
        }

        const created = await prisma.appointment.create({
            data: {
                patient: { connect: { id: req.user.patient.id } },
                type,
                mode,
                specialty: finalSpecialty,
                description,
                toolsRequired,
                meetLink,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                address: addressId ? { connect: { id: addressId } } : undefined,
                isEmergency: !!isEmergency,
            },
        });
        // If patient selected a specific doctor, pre-create an assignment as ACCEPTED position 1
        if (doctorId) {
            await prisma.appointmentAssignment.create({
                data: {
                    appointmentId: created.id,
                    doctorId,
                    status: 'ACCEPTED',
                    queuePosition: 1,
                    acceptedAt: new Date(),
                },
            });
        }

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
