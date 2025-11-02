import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import { attachUser, requireRole } from '../../middlewares/auth.js';

const router = Router();
router.use(attachUser(false), requireRole(['PATIENT']));

// Nearby pharmacies (very basic filter; replace with geo search)
router.get('/pharmacies/nearby', async (req, res, next) => {
    try {
        const { lat, lng } = req.query; // not used in this stub
        const pharmacies = await prisma.pharmacy.findMany({
            where: { isActive: true },
            include: {
                medicines: true
            },
            take: 20,
        });
        res.json(pharmacies);
    } catch (err) {
        next(err);
    }
});

// Place a medicine order
router.post('/orders', async (req, res, next) => {
    try {
        const { pharmacyId, items = [], addressId } = req.body; // items: [{ inventoryId, quantity }]
        if (!pharmacyId || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'pharmacyId and items are required' });
        }

        // Compute total from inventory
        const inventoryIds = items.map(i => i.inventoryId);
        const inv = await prisma.inventory.findMany({ where: { id: { in: inventoryIds } } });
        const invMap = new Map(inv.map(i => [i.id, i]));

        let total = 0;
        for (const it of items) {
            const row = invMap.get(it.inventoryId);
            if (!row) return res.status(400).json({ error: `Invalid inventoryId ${it.inventoryId}` });
            total += Number(row.price) * it.quantity;
        }

        const order = await prisma.medOrder.create({
            data: {
                patientId: req.user.patient.id,
                pharmacyId,
                total,
                address: addressId ? { connect: { id: addressId } } : undefined,
                items: {
                    create: items.map(it => ({
                        inventoryId: it.inventoryId,
                        quantity: it.quantity,
                        unitPrice: invMap.get(it.inventoryId).price,
                    })),
                },
            },
            include: { items: true },
        });

        res.status(201).json(order);
    } catch (err) {
        next(err);
    }
});

router.get('/orders', async (req, res, next) => {
    try {
        const orders = await prisma.medOrder.findMany({
            where: { patientId: req.user.patient.id },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(orders);
    } catch (err) {
        next(err);
    }
});

export default router;
