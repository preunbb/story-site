/**
 * Build a remote-generation prompt from an injury description.
 * @param {{ injuryDescription: string }} opts
 */
export function buildImagePrompt({ injuryDescription }) {
  return `Clinical medical illustration of a bilateral pair of human testes (testicles),
same composition and camera angle as the reference image: two oval testes side by side,
connected at the top by thick spermatic cords, resting on a plain neutral off-white surface.

MATCH THE REFERENCE EXACTLY for baseline anatomy and style:
- pale pink-tan glistening tissue
- dense visible vascular network: deep blue-purple larger veins branching from the cords,
  fine red capillary webbing across the entire surface
- taut smooth tunica, soft even clinical lighting, photo-real or high-end medical 3D render
- no scrotal skin — bare testes only, same scale and framing as reference

INJURY / DAMAGE (apply faithfully):
${injuryDescription}

Show the described trauma clearly on the tissue. Bruising, rupture, puncture, swelling,
asymmetry, fluid leaks, deflation, laceration, torsion discoloration, etc. as specified.
Keep the same bilateral specimen presentation — no people, no hands, no bodies, no text,
no labels, no logos. White or neutral background only.`;
}

export const NEGATIVE_PROMPT_HINTS = [
  "cartoon",
  "anime",
  "comic",
  "text",
  "labels",
  "watermark",
  "hands",
  "faces",
  "full body",
  "scrotum skin",
  "fried egg",
  "cooked egg",
].join(", ");
