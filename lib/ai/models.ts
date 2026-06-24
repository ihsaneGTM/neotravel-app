/**
 * Modèles Claude via Vercel AI Gateway (clé AI_GATEWAY_API_KEY, lue automatiquement).
 * Slugs gateway EXACTS — versions avec points, pas tirets.
 */
export const MODELS = {
  /** Agent conversationnel : qualification + mise en forme du devis. */
  agent: "anthropic/claude-sonnet-4.6",
  /** Classification légère (tri urgence / incohérence). */
  classifier: "anthropic/claude-haiku-4.5",
  /** Check IA anti-erreur avant envoi (raisonnement +). */
  reviewer: "anthropic/claude-opus-4.8",
} as const;
