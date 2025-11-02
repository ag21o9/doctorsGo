import { ChatOpenAI } from '@langchain/openai';

export const SPECIALTIES = [
  'GENERAL_PHYSICIAN','CARDIOLOGY','GYNECOLOGY','PEDIATRICS','ORTHOPEDICS','DERMATOLOGY','NEUROLOGY','PSYCHIATRY','PULMONOLOGY','GASTROENTEROLOGY','NEPHROLOGY','ENDOCRINOLOGY','ENT','OPHTHALMOLOGY','DENTISTRY','EMERGENCY_MEDICINE','UROLOGY','ONCOLOGY','RADIOLOGY','ANESTHESIOLOGY','RHEUMATOLOGY','PHYSIOTHERAPY','PATHOLOGY'
];

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function getModel() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY in environment');
  }
  return new ChatOpenAI({ model: DEFAULT_MODEL, temperature: 0, openAIApiKey: apiKey });
}

export async function aiClassifySpecialty(description) {
  const model = getModel();
  const sys = `You are a triage assistant. Map the patient's natural language description to the single closest medical specialty from this exact list (return the enum string exactly):\n${SPECIALTIES.join(', ')}.\nOutput strict JSON with keys: specialty (one of the list), confidence (0-1), reasoning (short).`;
  const user = `Description:\n"""\n${description}\n"""\nReturn JSON only.`;
  const resp = await model.invoke([
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ]);
  let data;
  try {
    data = JSON.parse(resp.content);
  } catch (e) {
    // fallback: try to extract specialty by simple match
    const text = typeof resp.content === 'string' ? resp.content : '';
    const found = SPECIALTIES.find((s) => text.toUpperCase().includes(s));
    return { specialty: found || 'GENERAL_PHYSICIAN', confidence: 0.4, reasoning: 'Heuristic fallback' };
  }
  if (!SPECIALTIES.includes(data.specialty)) {
    data.specialty = 'GENERAL_PHYSICIAN';
  }
  return {
    specialty: data.specialty,
    confidence: Number(data.confidence ?? 0.5),
    reasoning: data.reasoning ?? '',
  };
}

export async function aiGenerateAppointmentReport({ description, specialty }) {
  const model = getModel();
  const sys = `You are a clinical assistant. Given patient description and target specialty (${specialty}), propose a concise structured report. Output strict JSON with keys: diagnosis (string), summary (string), recommendations (string), equipmentRequired (string).`;
  const user = `Description:\n"""\n${description}\n"""\nReturn JSON only.`;
  const resp = await model.invoke([
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ]);
  try {
    const data = JSON.parse(resp.content);
    return {
      diagnosis: data.diagnosis || null,
      summary: data.summary || null,
      recommendations: data.recommendations || null,
      equipmentRequired: data.equipmentRequired || null,
    };
  } catch {
    return { diagnosis: null, summary: description?.slice(0, 500) || null, recommendations: null, equipmentRequired: null };
  }
}

// Produce a detailed triage analysis from a free-text description.
// Returns keys: likelyConditions[], symptomHighlights[], urgency, recommendedSpecialties[], requiredEquipment[], suggestedTests[], advice, redFlags[]
export async function aiDetailedAnalysis({ description, specialtyHint }) {
  const model = getModel();
  const sys = `You are a senior clinical triage assistant. Analyze the patient's description and output strict JSON only with these keys:
  likelyConditions: [ { name: string, likelihood: number (0-1), rationale: string } ],
  symptomHighlights: string[],
  urgency: one of ["EMERGENCY","HIGH","MEDIUM","LOW"],
  recommendedSpecialties: string[] (from this exact list: ${SPECIALTIES.join(', ')}),
  requiredEquipment: string[],
  suggestedTests: string[],
  advice: string,
  redFlags: string[]
  Keep it concise and clinically useful. Use ${specialtyHint || 'GENERAL_PHYSICIAN'} as a hint if applicable.`;
  const user = `Description:\n"""\n${description}\n"""\nReturn JSON only.`;
  const resp = await model.invoke([
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ]);
  try {
    const data = JSON.parse(resp.content);
    // Normalize defaults
    return {
      likelyConditions: Array.isArray(data.likelyConditions) ? data.likelyConditions : [],
      symptomHighlights: Array.isArray(data.symptomHighlights) ? data.symptomHighlights : [],
      urgency: data.urgency || 'MEDIUM',
      recommendedSpecialties: (Array.isArray(data.recommendedSpecialties) ? data.recommendedSpecialties : []).filter(s => SPECIALTIES.includes(s)),
      requiredEquipment: Array.isArray(data.requiredEquipment) ? data.requiredEquipment : [],
      suggestedTests: Array.isArray(data.suggestedTests) ? data.suggestedTests : [],
      advice: data.advice || '',
      redFlags: Array.isArray(data.redFlags) ? data.redFlags : [],
    };
  } catch {
    // Fallback minimal structure
    return {
      likelyConditions: [],
      symptomHighlights: [],
      urgency: 'MEDIUM',
      recommendedSpecialties: specialtyHint && SPECIALTIES.includes(specialtyHint) ? [specialtyHint] : ['GENERAL_PHYSICIAN'],
      requiredEquipment: [],
      suggestedTests: [],
      advice: description?.slice(0, 240) || '',
      redFlags: [],
    };
  }
}
