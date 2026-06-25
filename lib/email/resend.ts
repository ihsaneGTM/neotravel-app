import "server-only";
import { Resend } from "resend";

/** L'envoi email est-il configuré ? (clé Resend présente) */
export function resendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

const FROM = process.env.EMAIL_FROM || "NeoTravel <onboarding@resend.dev>";

/**
 * Envoie un email via Resend. Renvoie l'id du message (preuve d'envoi).
 * Lève une erreur explicite si non configuré ou si Resend renvoie une erreur.
 */
export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY manquante : l'envoi d'email n'est pas configuré.");
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) throw new Error(`Resend: ${error.message ?? String(error)}`);
  if (!data?.id) throw new Error("Resend: réponse sans id de message.");
  return data.id;
}

/** Rendu HTML du devis (email client). */
export function renderDevisEmail(input: {
  numero: string;
  client: string;
  trajet: string;
  dates: string;
  nb_voyageurs: number;
  lignes: { libelle: string; montant: number }[];
  prix_ttc: number;
}): { subject: string; html: string } {
  const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
  const rows = input.lignes
    .map((l) => {
      const fort = /Prix TTC|Prix HT|Sous-total/i.test(l.libelle);
      return `<tr style="${fort ? "font-weight:600;border-top:1px solid #e2e8f0;" : ""}">
        <td style="padding:6px 0;color:#475569;">${l.libelle}</td>
        <td style="padding:6px 0;text-align:right;color:#0f172a;">${eur(l.montant)}</td></tr>`;
    })
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border:1px solid #eceef2;border-radius:16px;padding:28px;">
      <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#4f46e5;font-weight:700;">NeoTravel</p>
      <h1 style="margin:6px 0 2px;font-size:22px;color:#0f172a;">Votre devis ${input.numero}</h1>
      <p style="margin:0 0 18px;color:#64748b;font-size:14px;">Bonjour ${input.client}, voici votre proposition de transport.</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:16px;">
        <tr><td style="padding:4px 0;color:#94a3b8;">Trajet</td><td style="padding:4px 0;text-align:right;color:#0f172a;">${input.trajet}</td></tr>
        <tr><td style="padding:4px 0;color:#94a3b8;">Dates</td><td style="padding:4px 0;text-align:right;color:#0f172a;">${input.dates}</td></tr>
        <tr><td style="padding:4px 0;color:#94a3b8;">Voyageurs</td><td style="padding:4px 0;text-align:right;color:#0f172a;">${input.nb_voyageurs}</td></tr>
      </table>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">${rows}</table>
      <div style="margin-top:18px;padding:14px 16px;background:#eef2ff;border-radius:12px;display:flex;justify-content:space-between;">
        <span style="color:#4338ca;font-weight:600;">Total TTC</span>
        <span style="color:#4338ca;font-weight:700;font-size:18px;">${eur(input.prix_ttc)}</span>
      </div>
      <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;">Devis indicatif valable 30 jours. Un conseiller NeoTravel reste à votre disposition.</p>
    </div>
  </div></body></html>`;

  return { subject: `Votre devis NeoTravel ${input.numero}`, html };
}
