// Génère/régénère les 3 photos de features manquantes ou à refaire (Nano Banana 2).
//   - feat-advisor  : REMPLACE la dame au téléphone (trop "IA") par une vraie interaction humaine
//   - feat-response : nouvelle image "Une réponse sous 2 heures"
//   - feat-quote    : nouvelle image "Un devis clair, sans surprise"
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("GEMINI_API_KEY manquante (à mettre dans .env.local, jamais commitée)."); process.exit(1); }
const MODEL = "gemini-3.1-flash-image";
const OUT = new URL("../public/landing/photos/", import.meta.url);
await mkdir(OUT, { recursive: true });

// Style : on insiste sur l'AUTHENTICITÉ pour éviter le rendu "trop IA" (peau naturelle, candid, documentaire).
const STYLE =
  "Authentic candid documentary photograph, real natural skin texture and pores, genuine unposed emotion, premium travel brand editorial aesthetic, soft natural window light, shallow depth of field, true-to-life colors, crisp 4K detail, photorealistic — NOT a 3D render, NOT illustration, NOT over-smoothed, no plastic skin, no uncanny faces. No text, no captions, no watermarks, no brand logos, no readable signage.";

const SPECS = [
  {
    name: "feat-advisor",
    ar: "4:3",
    prompt:
      "Two real people having a warm, genuine face-to-face conversation across a desk in a bright modern travel agency office: a friendly travel advisor in their 30s and a client, both leaning in slightly, smiling and engaged mid-discussion with natural hand gestures, authentic human connection and eye contact between them. Candid, unposed, documentary feel.",
  },
  {
    name: "feat-response",
    ar: "4:3",
    prompt:
      "A relaxed traveler standing outdoors on a sunny city street near a modern touring coach, smiling with relief while reading a quick reply on their smartphone — conveying a fast, reassuring response. Warm late-afternoon golden light, candid lifestyle moment, authentic natural expression.",
  },
  {
    name: "feat-quote",
    ar: "4:3",
    prompt:
      "A warm, confident handshake between a travel advisor and a satisfied client, both standing and smiling in a bright modern office, the moment a clear agreement is sealed — atmosphere of trust and transparency. Candid corporate lifestyle moment, natural light, genuine expressions.",
  },
];

async function genOne(spec) {
  const t0 = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${spec.prompt}\n\n${STYLE}` }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: spec.ar, imageSize: "4K" } },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${spec.name}: HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(`${spec.name}: ${JSON.stringify(data.error).slice(0, 200)}`);
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p) => p.inlineData || p.inline_data);
  if (!inline) throw new Error(`${spec.name}: pas d'image dans la réponse`);
  const b64 = (inline.inlineData || inline.inline_data).data;
  const raw = Buffer.from(b64, "base64");
  const meta = await sharp(raw).metadata();
  const jpeg = await sharp(raw).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  await writeFile(new URL(`${spec.name}.jpg`, OUT), jpeg);
  return `${spec.name}.jpg  ${meta.width}x${meta.height}  ${(jpeg.length / 1024 / 1024).toFixed(2)} Mo  (${((Date.now() - t0) / 1000).toFixed(1)}s)`;
}

const settled = await Promise.allSettled(SPECS.map(genOne));
let ok = 0;
settled.forEach((r, i) => {
  if (r.status === "fulfilled") { ok++; console.log("✓ " + r.value); }
  else console.log("✗ " + SPECS[i].name + " — " + r.reason.message);
});
console.log(`\n${ok}/${SPECS.length} photos générées dans public/landing/photos/`);
