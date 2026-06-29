import "server-only";
import PDFDocument from "pdfkit";
import { BUS_LOGO_B64 } from "./bus-logo";

// ── Palette de marque ───────────────────────────────────────────────────────
const INK = "#16170e";
const FOREST = "#2c3a1b";
const MUTED = "#595b4c";
const FAINT = "#8a8c7d";
const LINE = "#e6e4d6";
const LIME = "#d8e762";
const LIME_DEEP = "#c2d23f";
const SOFT = "#fbfcf8";

const W = 595.28; // A4 portrait
const M = 48; // marge contenu
const CW = W - 2 * M; // largeur contenu

export interface DevisPdfInput {
  numero: string;
  dateDevis: string; // ex "26 juin 2026"
  client: { nom: string; email: string | null; telephone: string | null };
  trajet: string; // "Paris → Lyon"
  typeLabel: string; // "Aller-retour"
  dateDepart: string;
  heureDepart?: string | null;
  dateRetour: string | null;
  nbVoyageurs: number;
  nbVehicules: number;
  nbChauffeurs: number;
  vehiculeLabel: string;
  prixTTC: number;
  inclus: string[];
  aCharge: string[];
}

const eur = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, " ") + " €";

function toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

/** Génère le PDF du devis CLIENT (version simple et soignée, sans le détail interne des coefficients). */
export async function generateDevisPDF(input: DevisPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `Devis NeoTravel ${input.numero}`, Author: "NeoTravel" } });
  const out = toBuffer(doc);

  // ── En-tête : logo bus + wordmark | contact à droite ──────────────────────
  try {
    doc.image(Buffer.from(BUS_LOGO_B64, "base64"), M, 40, { width: 60 });
  } catch { /* logo optionnel */ }
  doc.font("Helvetica-Bold").fontSize(18);
  doc.fillColor(INK).text("Neo", M + 70, 50, { continued: true });
  doc.fillColor(FOREST).text("Travel");
  doc.font("Helvetica").fontSize(8).fillColor(FAINT).text("Transport d'autocars avec chauffeur", M + 70, 74);

  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
  const cx = W - M - 200;
  doc.text("devis@neotravel.fr", cx, 48, { width: 200, align: "right" });
  doc.text("01 84 80 12 34", cx, 62, { width: 200, align: "right" });
  doc.text("Du lundi au vendredi · 9h–18h", cx, 76, { width: 200, align: "right" });

  // filet lime sous l'en-tête
  doc.rect(M, 98, CW, 2.5).fill(LIME);

  // ── Bloc titre ─────────────────────────────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(25).fillColor(INK).text(`DEVIS N° ${input.numero}`, M, 124, { width: CW, align: "center" });
  doc.font("Helvetica").fontSize(9.5).fillColor(FAINT).text("Valable 30 jours · sous réserve de disponibilité à la réservation", M, 156, { width: CW, align: "center" });

  // ── À l'attention de | Établi le ─────────────────────────────────────────────
  let y = 196;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(FOREST).text("À L'ATTENTION DE", M, y, { characterSpacing: 0.6 });
  doc.font("Helvetica-Bold").fontSize(12.5).fillColor(INK).text(input.client.nom, M, y + 13);
  let cy = y + 30;
  doc.font("Helvetica").fontSize(9.5).fillColor(MUTED);
  if (input.client.email) { doc.text(input.client.email, M, cy); cy += 13; }
  if (input.client.telephone) { doc.text(input.client.telephone, M, cy); }

  doc.font("Helvetica-Bold").fontSize(8).fillColor(FOREST).text("ÉTABLI LE", M, y, { width: CW, align: "right", characterSpacing: 0.6 });
  doc.font("Helvetica-Bold").fontSize(12.5).fillColor(INK).text(input.dateDevis, M, y + 13, { width: CW, align: "right" });

  // ── Bandeau de section ───────────────────────────────────────────────────────
  y = 268;
  doc.roundedRect(M, y, CW, 28, 7).fill(LIME);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("VOTRE VOYAGE", M, y + 9, { width: CW, align: "center", characterSpacing: 1 });

  // ── Lignes trajet ────────────────────────────────────────────────────────────
  y += 44;
  const rows: [string, string][] = [
    // La flèche "→" n'existe pas dans l'encodage Helvetica (pdfkit) → tiret style itinéraire.
    ["Trajet", input.trajet.replace(/\s*→\s*/g, " – ")],
    ["Type de déplacement", input.typeLabel],
    ["Date de départ", input.heureDepart ? `${input.dateDepart} à ${input.heureDepart}` : input.dateDepart],
    ...(input.dateRetour ? ([["Date de retour", input.dateRetour]] as [string, string][]) : []),
    ["Nombre de passagers", String(input.nbVoyageurs)],
    ["Véhicule", `${input.nbVehicules} × ${input.vehiculeLabel}`],
    ["Chauffeur", `${input.nbChauffeurs} chauffeur${input.nbChauffeurs > 1 ? "s" : ""}`],
  ];
  doc.fontSize(10.5);
  for (const [label, value] of rows) {
    doc.font("Helvetica").fillColor(MUTED).text(label, M + 2, y);
    doc.font("Helvetica-Bold").fillColor(INK).text(value, M, y, { width: CW - 2, align: "right" });
    y += 22;
    doc.moveTo(M, y - 5).lineTo(W - M, y - 5).lineWidth(0.6).strokeColor(LINE).stroke();
  }

  // ── Bandeau TARIF ────────────────────────────────────────────────────────────
  y += 12;
  doc.roundedRect(M, y, CW, 78, 12).fill(LIME);
  doc.roundedRect(M, y, CW, 78, 12).lineWidth(1).strokeColor(LIME_DEEP).stroke();
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text("TARIF TOTAL TTC", M + 24, y + 22, { characterSpacing: 0.8 });
  doc.font("Helvetica").fontSize(9).fillColor(FOREST).text("TVA 10% incluse · transport réalisé en France", M + 24, y + 42);
  doc.font("Helvetica-Bold").fontSize(30).fillColor(INK).text(eur(input.prixTTC), M, y + 22, { width: CW - 24, align: "right" });

  // ── Compris / À charge ───────────────────────────────────────────────────────
  y += 100;
  const colW = (CW - 24) / 2;
  const drawCol = (x: number, title: string, items: string[], dotColor: string) => {
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(FOREST).text(title, x, y, { characterSpacing: 0.6 });
    let iy = y + 16;
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTED);
    for (const it of items) {
      doc.circle(x + 3, iy + 5, 2.2).fill(dotColor);
      doc.fillColor(MUTED).text(it, x + 12, iy, { width: colW - 12 });
      iy += 16;
    }
  };
  drawCol(M, "CE PRIX COMPREND", input.inclus, LIME_DEEP);
  drawCol(M + colW + 24, "RESTE À VOTRE CHARGE", input.aCharge, "#b4452f");

  // ── Pied de page ─────────────────────────────────────────────────────────────
  const fy = 770;
  doc.moveTo(M, fy).lineTo(W - M, fy).lineWidth(0.8).strokeColor(LINE).stroke();
  doc.font("Helvetica").fontSize(8).fillColor(FAINT).text(
    "Pour confirmer votre réservation ou ajuster votre demande, votre conseiller NeoTravel reste à votre disposition. Horaires et adresses précis confirmés à la réservation.",
    M, fy + 10, { width: CW, align: "center" }
  );
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("NeoTravel · devis@neotravel.fr · 01 84 80 12 34", M, fy + 32, { width: CW, align: "center" });

  doc.end();
  return out;
}
