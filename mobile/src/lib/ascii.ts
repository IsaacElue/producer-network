// Generative ASCII "P" brandmark. A monospace character field where density
// maps to light/shadow — a mask of the letter P lit from the top-left, textured
// with seeded value-noise so every profile gets a unique-but-consistent motif.
// Pure math + strings; no image decoding, so it runs anywhere.

// Light → dense ramp. Index 0 is the faintest, last is the densest.
const RAMP = ' .·:-=+*ox#%@';

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}

function latticeRand(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = latticeRand(ix, iy, seed);
  const b = latticeRand(ix + 1, iy, seed);
  const c = latticeRand(ix, iy + 1, seed);
  const d = latticeRand(ix + 1, iy + 1, seed);
  const ux = smooth(fx);
  const uy = smooth(fy);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

function fbm(x: number, y: number, seed: number): number {
  return 0.6 * valueNoise(x, y, seed) + 0.4 * valueNoise(x * 2.3, y * 2.3, seed ^ 0x9e3779b9);
}

// Soft membership in an ellipse (1 inside, 0 outside, smooth boundary).
function ellipse(nx: number, ny: number, cx: number, cy: number, rx: number, ry: number): number {
  const d = ((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2;
  return 1 - clamp01((d - 0.82) / 0.36);
}

// Soft membership in an axis-aligned box.
function box(nx: number, ny: number, x0: number, x1: number, y0: number, y1: number): number {
  const e = 0.02;
  const sx = clamp01((nx - x0) / e) * clamp01((x1 - nx) / e);
  const sy = clamp01((ny - y0) / e) * clamp01((y1 - ny) / e);
  return sx * sy;
}

// Membership in the letter P: a vertical stem plus a top bowl (outer minus hole).
function pShape(nx: number, ny: number): number {
  const stem = box(nx, ny, 0.34, 0.45, 0.13, 0.87);
  const outer = ellipse(nx, ny, 0.5, 0.32, 0.2, 0.21);
  const hole = ellipse(nx, ny, 0.525, 0.32, 0.1, 0.105);
  const bowl = nx >= 0.335 ? outer * (1 - hole) : 0;
  return Math.max(stem, bowl);
}

// Generative ASCII texture for full-bleed backdrops. Organic domain-warped
// noise (no letter mask) with a `density` knob controlling how much of the
// ramp is used: low density → sparse faint dots, high density → dense field.
// Seeded, so each screen/profile gets a stable, distinct texture.
export function generateAsciiField(
  seed: string,
  cols: number,
  rows: number,
  density = 0.4,
): string[] {
  const s = hashSeed(seed);
  const d = clamp01(density);
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const ny = r / Math.max(1, rows - 1);
    let line = '';
    for (let c = 0; c < cols; c++) {
      const nx = c / Math.max(1, cols - 1);
      // Two scales of noise: coarse drifting bands + finer grain.
      const coarse = fbm(nx * 2.4 + 11, ny * 2.4 + 5, s);
      const grain = valueNoise(nx * 7.5 + 2, ny * 7.5 + 9, s ^ 0x51ed270b);
      let b = 0.62 * coarse + 0.38 * grain;
      // Density remaps the threshold/contrast so the field can be barely-there
      // or bold without changing the ramp.
      b = clamp01((b - (1 - d)) / Math.max(0.08, d));
      line += RAMP[Math.round(b * (RAMP.length - 1))];
    }
    lines.push(line);
  }
  return lines;
}

export function generateAsciiP(seed: string, cols = 54, rows = 36): string[] {
  const s = hashSeed(seed);
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const ny = r / (rows - 1);
    let line = '';
    for (let c = 0; c < cols; c++) {
      const nx = c / (cols - 1);
      const p = pShape(nx, ny);
      // Light from the top-left gives the mark depth.
      const light = clamp01(0.22 + 0.85 * (1 - (nx * 0.45 + ny * 0.72)));
      const noise = fbm(nx * 4.5 + 3, ny * 4.5 + 7, s);
      const body = clamp01(0.32 + 0.52 * light + 0.16 * noise);
      const bg = 0.03 + 0.09 * noise; // faint background texture
      const b = bg * (1 - p) + body * p;
      line += RAMP[Math.round(clamp01(b) * (RAMP.length - 1))];
    }
    lines.push(line);
  }
  return lines;
}
