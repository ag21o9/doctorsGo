import { Router } from 'express';
import { attachUser, requireRole } from '../../middlewares/auth.js';
import { aiClassifySpecialty, aiDetailedAnalysis } from '../../configs/ai.js';

const router = Router();
router.use(attachUser(false), requireRole(['PATIENT']));

router.post('/', async (req, res, next) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: 'description is required' });
    const result = await aiClassifySpecialty(description);
    res.json({ ...result });
  } catch (err) {
    next(err);
  }
});

// Detailed analysis: returns classification plus structured clinical analysis
// POST /api/patients/triage/analyze
// Body: { description: string, specialty?: string }
router.post('/analyze', async (req, res, next) => {
  try {
    const { description, specialty } = req.body;
    if (!description) return res.status(400).json({ error: 'description is required' });

    const triage = specialty ? { specialty, confidence: 0.5, reasoning: 'Provided by client' } : await aiClassifySpecialty(description);
    const analysis = await aiDetailedAnalysis({ description, specialtyHint: triage.specialty });

    res.json({
      specialty: triage.specialty,
      confidence: triage.confidence,
      reasoning: triage.reasoning,
      analysis,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
