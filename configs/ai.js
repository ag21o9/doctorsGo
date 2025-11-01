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
