/**
 * Modèles Claude via Vercel AI Gateway (clé AI_GATEWAY_API_KEY, lue automatiquement).
 * Slugs gateway EXACTS — versions avec points, pas tirets.
 */
export const MODELS = {
  /** Agent conversationnel : qualification + mise en forme du devis (bon tool-calling, faible coût). */
  agent: "google/gemini-2.5-flash",
  /** Classification légère (tri urgence / incohérence). */
  classifier: "anthropic/claude-haiku-4.5",
  /** Check IA anti-erreur avant envoi (raisonnement +). */
  reviewer: "anthropic/claude-opus-4.8",
} as const;
