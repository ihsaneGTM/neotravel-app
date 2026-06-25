// Génère les photos de la landing en 4K via Nano Banana 2 (gemini-3.1-flash-image), en parallèle.
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const KEY = process.env.GEMINI_API_KEY || "AQ.Ab8RN6L8uL7Sp-AsPRwJhR4ler-AKEH5m5zS4IIZgODDLuDEvA";
const MODEL = "gemini-3.1-flash-image";
const OUT = new URL("../public/landing/photos/", import.meta.url);
await mkdir(OUT, { recursive: true });

const STYLE =
  "Ultra-realistic cinematic editorial photograph, premium travel brand aesthetic, natural warm golden-hour light, shallow depth of field, high dynamic range, crisp 4K detail, tasteful and modern. No text, no captions, no watermarks, no brand logos, no readable signage.";

const SPECS = [
  {
    name: "hero",
    ar: "16:9",
    prompt:
      "A sleek modern luxury touring coach (European autocar / motorcoach) driving along a scenic open road through rolling French countryside at golden hour, dynamic three-quarter front angle, soft sun flare, warm cinematic colors, sense of journey and premium comfort.",
  },
  {
    name: "feat-exterior",
    ar: "4:3",
    prompt:
      "A modern premium motorcoach (autocar grand tourisme) parked, clean glossy dark bodywork with large tinted windows, elegant three-quarter front view, soft daylight, minimal clean background, professional automotive photography.",
  },
  {
    name: "feat-interior",
    ar: "4:3",
    prompt:
      "The interior of a premium modern touring coach: comfortable reclining seats in tasteful neutral upholstery, clean spacious aisle, warm ambient lighting and soft daylight through large windows, inviting and high-end, no people.",
  },
  {
    name: "feat-advisor",
    ar: "4:3",
    prompt:
      "A friendly professional travel advisor wearing a discreet headset, smiling warmly while helping a customer by phone at a bright modern desk, soft natural window light, approachable and trustworthy, corporate lifestyle photography.",
  },
  {
    name: "svc-corporate",
    ar: "16:9",
    prompt:
      "A small group of well-dressed business professionals stepping aboard a modern luxury coach for a corporate seminar trip, bright optimistic daytime mood, candid editorial business-travel photography.",
  },
  {
    name: "svc-school",
    ar: "16:9",
    prompt:
      "A cheerful school field-trip scene viewed from a respectful distance and slightly from behind: a modern coach with a group of students and a teacher organizing to board on a sunny day, safe and well-organized atmosphere, editorial photography, faces not prominent.",
  },
  {
    name: "svc-students",
    ar: "16:9",
    prompt:
      "A lively group of happy university students with backpacks boarding a coach for a weekend trip, energetic friendly vibe, warm late-afternoon light, candid editorial travel photography.",
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
  // Master 4K compressé + variante web (max 2560px) pour la perf.
  const meta = await sharp(raw).metadata();
  const jpeg = await sharp(raw).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  await writeFile(new URL(`${spec.name}.jpg`, OUT), jpeg);
  return `${spec.name}.jpg  ${meta.width}x${meta.height}  ${(jpeg.length / 1024 / 1024).toFixed(2)} Mo  (${((Date.now() - t0) / 1000).toFixed(1)}s)`;
}

const settled = await Promise.allSettled(SPECS.map(genOne));
let ok = 0;
settled.forEach((r, i) => {
  if (r.status === "fulfilled") {
    ok++;
    console.log("✓ " + r.value);
  } else {
    console.log("✗ " + SPECS[i].name + " — " + r.reason.message);
  }
});
console.log(`\n${ok}/${SPECS.length} photos générées dans public/landing/photos/`);
