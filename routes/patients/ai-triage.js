import { Router } from 'express';
import { attachUser, requireRole } from '../../middlewares/auth.js';
import { aiClassifySpecialty, SPECIALTIES } from '../../configs/ai.js';

const router = Router();
router.use(attachUser(false), requireRole(['PATIENT']));

router.post('/', async (req, res, next) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: 'description is required' });
    const result = await aiClassifySpecialty(description);
    res.json({ ...result, allowedSpecialties: SPECIALTIES });
  } catch (err) {
    next(err);
  }
});

export default router;
