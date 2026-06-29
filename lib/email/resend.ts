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
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY manquante : l'envoi d'email n'est pas configuré.");
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
  });
  if (error) throw new Error(`Resend: ${error.message ?? String(error)}`);
  if (!data?.id) throw new Error("Resend: réponse sans id de message.");
  return data.id;
}

/**
 * Note d'accompagnement (corps de l'email) — sobre, aux couleurs NeoTravel.
 * Le devis détaillé est en PIÈCE JOINTE PDF ; l'email ne fait que l'introduire.
 */
export function renderDevisEmail(input: {
  numero: string;
  client: string;
  trajet: string;
  dates: string;
  nb_voyageurs: number;
  prix_ttc: number;
  /** Lien vers la page publique pour consulter et signer le devis en ligne. */
  signUrl?: string;
}): { subject: string; html: string } {
  const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);

  const html = `<!doctype html><html><body style="margin:0;background:#f4f3e8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;">
    <div style="background:#ffffff;border:1px solid #e6e4d6;border-radius:18px;overflow:hidden;box-shadow:0 4px 16px rgba(22,23,14,.06);">
      <!-- bandeau encre -->
      <div style="background:#16170e;padding:24px 28px;">
        <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.3px;color:#ffffff;">Neo<span style="color:#d8e762;">Travel</span></p>
        <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,.6);">Transport d'autocars avec chauffeur</p>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 4px;font-size:21px;color:#16170e;font-weight:800;">Votre devis ${input.numero}</h1>
        <p style="margin:0 0 20px;color:#595b4c;font-size:14px;line-height:1.5;">Bonjour ${input.client},<br/>Merci de votre confiance. Vous trouverez votre devis détaillé en <b style="color:#16170e;">pièce jointe (PDF)</b>. En voici l'essentiel :</p>

        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr><td style="padding:7px 0;color:#8a8c7d;border-bottom:1px solid #f1f0e6;">Trajet</td><td style="padding:7px 0;text-align:right;color:#16170e;font-weight:600;border-bottom:1px solid #f1f0e6;">${input.trajet}</td></tr>
          <tr><td style="padding:7px 0;color:#8a8c7d;border-bottom:1px solid #f1f0e6;">Dates</td><td style="padding:7px 0;text-align:right;color:#16170e;font-weight:600;border-bottom:1px solid #f1f0e6;">${input.dates}</td></tr>
          <tr><td style="padding:7px 0;color:#8a8c7d;">Voyageurs</td><td style="padding:7px 0;text-align:right;color:#16170e;font-weight:600;">${input.nb_voyageurs}</td></tr>
        </table>

        <div style="margin-top:20px;padding:16px 20px;background:#d8e762;border-radius:14px;text-align:center;">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.5px;color:#2c3a1b;text-transform:uppercase;">Tarif total TTC</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#16170e;">${eur(input.prix_ttc)}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#2c3a1b;">TVA 10% incluse</p>
        </div>

        ${input.signUrl ? `<div style="margin-top:22px;text-align:center;">
          <a href="${input.signUrl}" style="display:inline-block;background:#16170e;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 30px;border-radius:999px;">Consulter et signer le devis en ligne →</a>
          <p style="margin:10px 0 0;font-size:11px;color:#8a8c7d;">Acceptez votre devis en un clic, ou demandez une modification.</p>
        </div>` : ""}

        <p style="margin:22px 0 0;color:#8a8c7d;font-size:12px;line-height:1.5;">Devis valable 30 jours, sous réserve de disponibilité à la réservation. Votre conseiller NeoTravel reste à votre disposition pour toute précision.</p>
      </div>
    </div>
    <p style="text-align:center;margin:16px 0 0;color:#8a8c7d;font-size:11px;">NeoTravel · devis@neotravel.fr · 01 84 80 12 34</p>
  </div></body></html>`;

  return { subject: `Votre devis NeoTravel ${input.numero}`, html };
}
