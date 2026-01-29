// Google Cloud Translation API utility
// Docs: https://cloud.google.com/translate/docs/reference/rest/v2/translate

const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const TRANSLATE_API_URL = "https://translation.googleapis.com/language/translate/v2";
const DETECT_API_URL = "https://translation.googleapis.com/language/translate/v2/detect";

export interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage: string;
}

export interface DetectionResult {
  language: string;
  confidence: number;
}

/**
 * Traduce un testo nella lingua target
 * @param text - Testo da tradurre
 * @param targetLanguage - Codice lingua destinazione (es: "it", "en", "de")
 * @param sourceLanguage - Codice lingua sorgente (opzionale, auto-detect se non specificato)
 */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TranslationResult | null> {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    console.error("GOOGLE_TRANSLATE_API_KEY not configured");
    return null;
  }

  // Non tradurre testi troppo corti o vuoti
  if (!text || text.trim().length < 2) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      key: GOOGLE_TRANSLATE_API_KEY,
      q: text,
      target: targetLanguage,
      format: "text",
    });

    if (sourceLanguage) {
      params.append("source", sourceLanguage);
    }

    const response = await fetch(`${TRANSLATE_API_URL}?${params}`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Google Translate API error:", error);
      return null;
    }

    const data = await response.json();
    const translation = data.data.translations[0];

    return {
      translatedText: translation.translatedText,
      detectedSourceLanguage: translation.detectedSourceLanguage || sourceLanguage || "unknown",
    };
  } catch (error) {
    console.error("Translation error:", error);
    return null;
  }
}

/**
 * Rileva la lingua di un testo
 * @param text - Testo da analizzare
 */
export async function detectLanguage(text: string): Promise<DetectionResult | null> {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    console.error("GOOGLE_TRANSLATE_API_KEY not configured");
    return null;
  }

  if (!text || text.trim().length < 2) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      key: GOOGLE_TRANSLATE_API_KEY,
      q: text,
    });

    const response = await fetch(`${DETECT_API_URL}?${params}`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Google Detect API error:", error);
      return null;
    }

    const data = await response.json();
    const detection = data.data.detections[0][0];

    return {
      language: detection.language,
      confidence: detection.confidence,
    };
  } catch (error) {
    console.error("Language detection error:", error);
    return null;
  }
}

/**
 * Estrae il codice lingua dal browser (es: "it-IT" -> "it")
 */
export function normalizeLanguageCode(browserLanguage: string): string {
  // Prendi solo i primi 2 caratteri (es: "it-IT" -> "it", "en-US" -> "en")
  return browserLanguage.split("-")[0].toLowerCase();
}

/**
 * Verifica se due codici lingua sono uguali
 */
export function isSameLanguage(lang1: string | null, lang2: string | null): boolean {
  if (!lang1 || !lang2) return false;
  return normalizeLanguageCode(lang1) === normalizeLanguageCode(lang2);
}
