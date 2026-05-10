import { useState, useEffect, useCallback, useRef } from "react";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  detected_language?: string | null;
  translated_content?: string | null;
  translated_to?: string | null;
}

interface TranslationState {
  [messageId: string]: {
    translatedContent: string | null;
    detectedLanguage: string | null;
    isLoading: boolean;
    error: string | null;
    showOriginal: boolean;
  };
}

interface UseTranslationOptions {
  userId: string;
  messages: Message[];
  targetLanguage?: string | null;
  enabled?: boolean;
}

function normalizeLanguage(language?: string | null) {
  return language?.split("-")[0]?.toLowerCase() || null;
}

function getNavigatorLanguage() {
  if (typeof navigator === "undefined") return null;
  return normalizeLanguage(navigator.language);
}

/**
 * Hook per gestire la traduzione automatica dei messaggi
 *
 * - Usa la lingua preferita del lettore, con fallback alla lingua del browser
 * - Traduce solo i messaggi degli altri utenti
 * - Usa le traduzioni già salvate nel DB quando disponibili
 * - Permette di mostrare/nascondere l'originale
 */
export function useTranslation({ userId, messages, targetLanguage, enabled = true }: UseTranslationOptions) {
  const [translations, setTranslations] = useState<TranslationState>({});
  const [displayLanguage, setDisplayLanguage] = useState<string | null>(
    () => normalizeLanguage(targetLanguage) || getNavigatorLanguage()
  );
  const [showOriginalAll, setShowOriginalAll] = useState(false);
  const pendingTranslations = useRef<Set<string>>(new Set());

  // Usa la lingua profilo quando disponibile; altrimenti ripiega sul browser.
  useEffect(() => {
    setDisplayLanguage(normalizeLanguage(targetLanguage) || getNavigatorLanguage());
  }, [targetLanguage]);

  useEffect(() => {
    setTranslations({});
    pendingTranslations.current.clear();
  }, [displayLanguage]);

  // Traduce un singolo messaggio
  const translateMessage = useCallback(
    async (message: Message) => {
      const messageId = message.id;

      // Non tradurre messaggi temporanei (ottimistici)
      if (messageId.startsWith("temp-")) return;

      // Non tradurre i propri messaggi
      if (message.sender_id === userId) return;

      // Non tradurre se già in corso
      if (pendingTranslations.current.has(messageId)) return;

      if (!displayLanguage) return;

      // Se ha già una traduzione salvata nel DB per la lingua corrente, usala
      if (
        message.translated_content &&
        normalizeLanguage(message.translated_to) === displayLanguage
      ) {
        setTranslations((prev) => ({
          ...prev,
          [messageId]: {
            translatedContent: message.translated_content!,
            detectedLanguage: message.detected_language || null,
            isLoading: false,
            error: null,
            showOriginal: false,
          },
        }));
        return;
      }

      // Se la lingua rilevata è uguale a quella del lettore, non tradurre
      if (normalizeLanguage(message.detected_language) === displayLanguage) {
        setTranslations((prev) => ({
          ...prev,
          [messageId]: {
            translatedContent: null,
            detectedLanguage: message.detected_language ?? null,
            isLoading: false,
            error: null,
            showOriginal: false,
          },
        }));
        return;
      }

      // Segna come in caricamento
      pendingTranslations.current.add(messageId);
      setTranslations((prev) => ({
        ...prev,
        [messageId]: {
          translatedContent: null,
          detectedLanguage: null,
          isLoading: true,
          error: null,
          showOriginal: false,
        },
      }));

      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId,
            targetLanguage: displayLanguage,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Translation failed");
        }

        setTranslations((prev) => ({
          ...prev,
          [messageId]: {
            translatedContent: data.translatedContent,
            detectedLanguage: data.detectedLanguage,
            isLoading: false,
            error: null,
            showOriginal: false,
          },
        }));
      } catch (error) {
        console.error("Translation error:", error);
        setTranslations((prev) => ({
          ...prev,
          [messageId]: {
            translatedContent: null,
            detectedLanguage: null,
            isLoading: false,
            error: error instanceof Error ? error.message : "Translation failed",
            showOriginal: false,
          },
        }));
      } finally {
        pendingTranslations.current.delete(messageId);
      }
    },
    [userId, displayLanguage]
  );

  // Traduce automaticamente tutti i messaggi quando cambiano
  useEffect(() => {
    if (!enabled) return;

    messages.forEach((message) => {
      // Salta se già tradotto o in corso
      if (translations[message.id]?.translatedContent !== undefined) return;
      if (translations[message.id]?.isLoading) return;

      translateMessage(message);
    });
  }, [messages, enabled, translateMessage, translations]);

  // Toggle per mostrare/nascondere l'originale
  const toggleShowOriginal = useCallback((messageId: string) => {
    setTranslations((prev) => ({
      ...prev,
      [messageId]: {
        ...prev[messageId],
        showOriginal: !prev[messageId]?.showOriginal,
      },
    }));
  }, []);

  const toggleShowOriginalAll = useCallback(() => {
    setShowOriginalAll((prev) => !prev);
  }, []);

  // Restituisce il contenuto da mostrare per un messaggio
  const getDisplayContent = useCallback(
    (message: Message) => {
      const state = translations[message.id];

      // Se è un proprio messaggio, mostra sempre l'originale
      if (message.sender_id === userId) {
        return {
          content: message.content,
          isTranslated: false,
          isLoading: false,
          showOriginal: false,
          canToggle: false,
        };
      }

      // Se non c'è stato di traduzione, mostra l'originale
      if (!state) {
        return {
          content: message.content,
          isTranslated: false,
          isLoading: false,
          showOriginal: false,
          canToggle: false,
        };
      }

      // Se sta caricando
      if (state.isLoading) {
        return {
          content: message.content,
          isTranslated: false,
          isLoading: true,
          showOriginal: false,
          canToggle: false,
        };
      }

      // Se non c'è traduzione (stessa lingua o errore)
      if (!state.translatedContent) {
        return {
          content: message.content,
          isTranslated: false,
          isLoading: false,
          showOriginal: false,
          canToggle: false,
        };
      }

      // Se l'utente vuole vedere l'originale (globale o per-messaggio)
      if (showOriginalAll || state.showOriginal) {
        return {
          content: message.content,
          isTranslated: false,
          isLoading: false,
          showOriginal: true,
          canToggle: true,
          originalContent: message.content,
          translatedContent: state.translatedContent,
        };
      }

      // Mostra la traduzione
      return {
        content: state.translatedContent,
        isTranslated: true,
        isLoading: false,
        showOriginal: false,
        canToggle: true,
        originalContent: message.content,
        translatedContent: state.translatedContent,
      };
    },
    [translations, userId, showOriginalAll]
  );

  return {
    translations,
    browserLanguage: displayLanguage || "en",
    displayLanguage,
    showOriginalAll,
    translateMessage,
    toggleShowOriginal,
    toggleShowOriginalAll,
    getDisplayContent,
  };
}
