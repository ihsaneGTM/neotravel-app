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

/**
 * Email de RELANCE d'un devis envoyé (cadence J+1 / J+3 / J+7).
 * Ton adapté à l'ancienneté : rappel doux → invitation à finaliser.
 */
export function renderRelanceEmail(input: {
  numero: string;
  client: string;
  trajet: string;
  dates: string;
  prix_ttc: number;
  /** "j1" | "j3" | "j7" | autre — module le ton. */
  type: string;
  signUrl?: string;
}): { subject: string; html: string } {
  const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(n);
  const intro =
    input.type === "j1"
      ? "Avez-vous bien reçu le devis que nous vous avons adressé ? Je me permets un petit mot pour m'assurer qu'il vous est bien parvenu."
      : input.type === "j7"
      ? "Votre projet de déplacement est toujours d'actualité ? Votre devis reste disponible — n'hésitez pas si vous souhaitez en discuter ou l'ajuster."
      : "Je reviens vers vous au sujet de votre devis. Restez-vous sur ce projet ? Je suis à votre disposition pour toute question.";
  const subject =
    input.type === "j1"
      ? `Avez-vous reçu votre devis ${input.numero} ?`
      : `Votre devis NeoTravel ${input.numero} — toujours d'actualité ?`;

  const html = `<!doctype html><html><body style="margin:0;background:#f4f3e8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;">
    <div style="background:#ffffff;border:1px solid #e6e4d6;border-radius:18px;overflow:hidden;box-shadow:0 4px 16px rgba(22,23,14,.06);">
      <div style="background:#16170e;padding:24px 28px;">
        <p style="margin:0;font-size:13px;font-weight:800;color:#ffffff;">Neo<span style="color:#d8e762;">Travel</span></p>
        <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,.6);">Transport d'autocars avec chauffeur</p>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;color:#16170e;font-weight:800;">Bonjour ${input.client},</h1>
        <p style="margin:0 0 20px;color:#595b4c;font-size:14px;line-height:1.5;">${intro}</p>
        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr><td style="padding:7px 0;color:#8a8c7d;border-bottom:1px solid #f1f0e6;">Devis</td><td style="padding:7px 0;text-align:right;color:#16170e;font-weight:600;border-bottom:1px solid #f1f0e6;">${input.numero}</td></tr>
          <tr><td style="padding:7px 0;color:#8a8c7d;border-bottom:1px solid #f1f0e6;">Trajet</td><td style="padding:7px 0;text-align:right;color:#16170e;font-weight:600;border-bottom:1px solid #f1f0e6;">${input.trajet}</td></tr>
          <tr><td style="padding:7px 0;color:#8a8c7d;border-bottom:1px solid #f1f0e6;">Dates</td><td style="padding:7px 0;text-align:right;color:#16170e;font-weight:600;border-bottom:1px solid #f1f0e6;">${input.dates}</td></tr>
          <tr><td style="padding:7px 0;color:#8a8c7d;">Tarif TTC</td><td style="padding:7px 0;text-align:right;color:#16170e;font-weight:700;">${eur(input.prix_ttc)}</td></tr>
        </table>
        ${input.signUrl ? `<div style="margin-top:22px;text-align:center;">
          <a href="${input.signUrl}" style="display:inline-block;background:#16170e;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 30px;border-radius:999px;">Consulter et signer le devis →</a>
          <p style="margin:10px 0 0;font-size:11px;color:#8a8c7d;">Acceptez votre devis en un clic, ou demandez une modification.</p>
        </div>` : ""}
        <p style="margin:22px 0 0;color:#8a8c7d;font-size:12px;line-height:1.5;">Si vous avez déjà donné suite, merci de ne pas tenir compte de ce message. Votre conseiller NeoTravel reste à votre écoute.</p>
      </div>
    </div>
    <p style="text-align:center;margin:16px 0 0;color:#8a8c7d;font-size:11px;">NeoTravel · devis@neotravel.fr · 01 84 80 12 34</p>
  </div></body></html>`;
  return { subject, html };
}

/**
 * Estimation PROVISOIRE envoyée automatiquement pour les demandes simples.
 * Clairement indicative et sujette à confirmation — un conseiller envoie le devis définitif.
 */
export function renderEstimationEmail(input: {
  client: string;
  trajet: string;
  dates: string;
  nb_voyageurs: number;
  prix_ttc: number;
}): { subject: string; html: string } {
  const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(n);
  const html = `<!doctype html><html><body style="margin:0;background:#f4f3e8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;">
    <div style="background:#ffffff;border:1px solid #e6e4d6;border-radius:18px;overflow:hidden;box-shadow:0 4px 16px rgba(22,23,14,.06);">
      <div style="background:#16170e;padding:24px 28px;">
        <p style="margin:0;font-size:13px;font-weight:800;color:#ffffff;">Neo<span style="color:#d8e762;">Travel</span></p>
        <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,.6);">Transport d'autocars avec chauffeur</p>
      </div>
      <div style="padding:28px;">
        <span style="display:inline-block;background:#eef3c2;color:#2c3a1b;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:.4px;">Estimation provisoire</span>
        <h1 style="margin:12px 0 4px;font-size:20px;color:#16170e;font-weight:800;">Une première estimation de votre voyage</h1>
        <p style="margin:0 0 20px;color:#595b4c;font-size:14px;line-height:1.5;">Bonjour ${input.client},<br/>Merci pour votre demande. Voici une <b style="color:#16170e;">estimation indicative</b> en attendant votre devis définitif, qu'un conseiller vous confirme très vite.</p>
        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr><td style="padding:7px 0;color:#8a8c7d;border-bottom:1px solid #f1f0e6;">Trajet</td><td style="padding:7px 0;text-align:right;color:#16170e;font-weight:600;border-bottom:1px solid #f1f0e6;">${input.trajet}</td></tr>
          <tr><td style="padding:7px 0;color:#8a8c7d;border-bottom:1px solid #f1f0e6;">Dates</td><td style="padding:7px 0;text-align:right;color:#16170e;font-weight:600;border-bottom:1px solid #f1f0e6;">${input.dates}</td></tr>
          <tr><td style="padding:7px 0;color:#8a8c7d;">Voyageurs</td><td style="padding:7px 0;text-align:right;color:#16170e;font-weight:600;">${input.nb_voyageurs}</td></tr>
        </table>
        <div style="margin-top:20px;padding:16px 20px;background:#d8e762;border-radius:14px;text-align:center;">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.5px;color:#2c3a1b;text-transform:uppercase;">Estimation à partir de</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#16170e;">${eur(input.prix_ttc)}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#2c3a1b;">TTC indicatif · TVA 10% incluse</p>
        </div>
        <p style="margin:18px 0 0;color:#8a8c7d;font-size:12px;line-height:1.5;"><b style="color:#595b4c;">Montant non contractuel</b> : il peut varier selon les disponibilités et les détails finaux. Votre conseiller NeoTravel vous adresse le devis définitif sous 24 h.</p>
      </div>
    </div>
    <p style="text-align:center;margin:16px 0 0;color:#8a8c7d;font-size:11px;">NeoTravel · devis@neotravel.fr · 01 84 80 12 34</p>
  </div></body></html>`;
  return { subject: "Votre estimation NeoTravel (provisoire)", html };
}
