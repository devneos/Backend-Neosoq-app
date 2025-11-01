// Simple translation helper with placeholder behavior.
// If TRANSLATE_API_KEY is provided this helper can be extended to call a real
// translation API. For now it returns the provided value and copies english -> arabic
// when no real translator is configured.
const translateText = async (text, target = 'ar') => {
  // no-op placeholder: in production call Google Translate API or a service
  if (!text) return '';
  return text; // fallback: return the same text (frontend requests will request lang)
};

const ensureLocalized = async (input) => {
  // Accept either string or {en,ar}
  if (!input) return { en: '', ar: '' };
  if (typeof input === 'string') return { en: input, ar: '' };
  return { en: input.en || '', ar: input.ar || '' };
};

module.exports = { translateText, ensureLocalized };
