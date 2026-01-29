import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { getUser } from "~/lib/session.server";
import { createClient } from "~/lib/supabase.server";
import { translateText, isSameLanguage } from "~/lib/translate.server";

/**
 * POST /api/translate
 *
 * Traduce un messaggio e salva la traduzione nel database.
 *
 * Body: {
 *   messageId: string,
 *   targetLanguage: string (es: "it", "en", "de")
 * }
 *
 * Response: {
 *   translatedContent: string,
 *   detectedLanguage: string
 * }
 */
export async function action({ request }: ActionFunctionArgs) {
  // Verifica autenticazione
  const user = await getUser(request);
  if (!user) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  // Valida metodo
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { messageId, targetLanguage } = body;

    if (!messageId || !targetLanguage) {
      return data({ error: "Missing messageId or targetLanguage" }, { status: 400 });
    }

    const supabase = createClient(request);

    // Recupera il messaggio
    const { data: message, error: fetchError } = await supabase
      .from("messages")
      .select("id, content, detected_language, translated_content, translated_to, conversation_id")
      .eq("id", messageId)
      .single();

    if (fetchError || !message) {
      return data({ error: "Message not found" }, { status: 404 });
    }

    // Verifica che l'utente sia partecipante della conversazione
    const { data: conversation } = await supabase
      .from("conversations")
      .select("participant_1, participant_2")
      .eq("id", message.conversation_id)
      .single();

    if (!conversation || (conversation.participant_1 !== user.id && conversation.participant_2 !== user.id)) {
      return data({ error: "Unauthorized" }, { status: 403 });
    }

    // Se la traduzione esiste già per questa lingua, restituiscila
    if (message.translated_content && message.translated_to === targetLanguage) {
      return data({
        translatedContent: message.translated_content,
        detectedLanguage: message.detected_language,
        cached: true,
      });
    }

    // Traduci il messaggio
    const translation = await translateText(message.content, targetLanguage);

    if (!translation) {
      return data({ error: "Translation failed" }, { status: 500 });
    }

    // Se la lingua rilevata è uguale a quella target, non serve traduzione
    if (isSameLanguage(translation.detectedSourceLanguage, targetLanguage)) {
      // Salva solo la lingua rilevata, senza traduzione
      await supabase
        .from("messages")
        .update({ detected_language: translation.detectedSourceLanguage })
        .eq("id", messageId);

      return data({
        translatedContent: null,
        detectedLanguage: translation.detectedSourceLanguage,
        sameLanguage: true,
      });
    }

    // Salva la traduzione nel database
    const { error: updateError } = await supabase
      .from("messages")
      .update({
        detected_language: translation.detectedSourceLanguage,
        translated_content: translation.translatedText,
        translated_to: targetLanguage,
      })
      .eq("id", messageId);

    if (updateError) {
      console.error("Error saving translation:", updateError);
      // Restituisci comunque la traduzione anche se non salvata
    }

    return data({
      translatedContent: translation.translatedText,
      detectedLanguage: translation.detectedSourceLanguage,
      cached: false,
    });
  } catch (error) {
    console.error("Translation API error:", error);
    return data({ error: "Internal server error" }, { status: 500 });
  }
}
