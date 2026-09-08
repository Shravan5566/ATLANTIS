/**
 * lib/colors.ts - Scientific color palette definitions, log/linear normalization, and canvas rasterization
 */

export interface ColorStop {
  pos: number;
  r: number;
  g: number;
  b: number;
}

export const PALETTES: Record<string, ColorStop[]> = {
  // Thermal: Deep Navy -> Cyan -> Green -> Yellow -> Red
  thermal: [
    { pos: 0.0, r: 3, g: 13, b: 64 },
    { pos: 0.25, r: 0, g: 210, b: 255 },
    { pos: 0.5, r: 56, g: 239, b: 125 },
    { pos: 0.75, r: 249, g: 212, b: 35 },
    { pos: 1.0, r: 255, g: 42, b: 42 },
  ],
  // Haline: Deep Blue -> Teal -> Cyan -> Mint -> Light Gold
  haline: [
    { pos: 0.0, r: 0, g: 16, b: 64 },
    { pos: 0.25, r: 0, g: 95, b: 115 },
    { pos: 0.5, r: 10, g: 147, b: 150 },
    { pos: 0.75, r: 148, g: 210, b: 189 },
    { pos: 1.0, r: 233, g: 216, b: 166 },
  ],
  // CoolWarm: Blue -> White -> Red (Divergent)
  coolwarm: [
    { pos: 0.0, r: 33, g: 102, b: 172 },
    { pos: 0.5, r: 247, g: 247, b: 247 },
    { pos: 1.0, r: 178, g: 24, b: 43 },
  ],
  // Viridis: Purple -> Blue -> Teal -> Green -> Yellow
  viridis: [
    { pos: 0.0, r: 68, g: 1, b: 84 },
    { pos: 0.25, r: 49, g: 104, b: 142 },
    { pos: 0.5, r: 53, g: 183, b: 121 },
    { pos: 0.75, r: 181, g: 222, b: 43 },
    { pos: 1.0, r: 253, g: 231, b: 37 },
  ],
  // Plasma: Deep Violet -> Magenta -> Orange -> Yellow
  plasma: [
    { pos: 0.0, r: 13, g: 8, b: 135 },
    { pos: 0.3, r: 156, g: 23, b: 158 },
    { pos: 0.6, r: 237, g: 105, b: 93 },
    { pos: 0.85, r: 251, g: 185, b: 56 },
    { pos: 1.0, r: 240, g: 249, b: 33 },
  ],
};

/**
 * Normalizes a scalar value to [0.0, 1.0] under linear or logarithmic scaling
 */
export function normalizeValue(
  val: number,
  minVal: number,
  maxVal: number,
  scaleType: "linear" | "log" = "linear"
): number {
  const range = maxVal > minVal ? maxVal - minVal : 1.0;
  if (scaleType === "log") {
    // Offset by minVal so log argument is strictly >= 0
    const offset = Math.max(0, val - minVal);
    return Math.log1p(offset) / Math.log1p(range);
  }
  return (val - minVal) / range;
}

/**
 * Returns [r, g, b, a] for a normalized value t between 0.0 and 1.0
 */
export function interpolateColor(
  t: number,
  paletteName: string = "thermal",
  alpha: number = 215
): [number, number, number, number] {
  const stops = PALETTES[paletteName] || PALETTES.viridis;
  const clampedT = Math.max(0, Math.min(1, t));

  for (let i = 0; i < stops.length - 1; i++) {
    const s1 = stops[i];
    const s2 = stops[i + 1];
    if (clampedT >= s1.pos && clampedT <= s2.pos) {
      const span = s2.pos - s1.pos;
      const factor = span > 0 ? (clampedT - s1.pos) / span : 0;
      const r = Math.round(s1.r + (s2.r - s1.r) * factor);
      const g = Math.round(s1.g + (s2.g - s1.g) * factor);
      const b = Math.round(s1.b + (s2.b - s1.b) * factor);
      return [r, g, b, alpha];
    }
  }

  const last = stops[stops.length - 1];
  return [last.r, last.g, last.b, alpha];
}

/**
 * Accurately determines if a coordinate in the 68°–90°E, 6°–25°N bounding box is on land
 * (Indian mainland, Sri Lanka, Bangladesh, Pakistan, Myanmar) so the satellite terrain remains 100% pristine.
 */
export function isSubcontinentLand(lat: number, lon: number): boolean {
  // Sri Lanka
  if (lat >= 5.8 && lat <= 9.9 && lon >= 79.5 && lon <= 82.0) return true;

  // Indian Peninsula South (lat 8.0 - 15.0)
  if (lat >= 8.0 && lat < 10.0 && lon >= 76.4 && lon <= 79.9) return true;
  if (lat >= 10.0 && lat < 12.0 && lon >= 75.5 && lon <= 80.1) return true;
  if (lat >= 12.0 && lat < 14.0 && lon >= 74.4 && lon <= 80.5) return true;
  if (lat >= 14.0 && lat < 16.0 && lon >= 73.6 && lon <= 81.0) return true;

  // Deccan / Central India (lat 16.0 - 20.0)
  if (lat >= 16.0 && lat < 18.0 && lon >= 73.0 && lon <= 83.0) return true;
  if (lat >= 18.0 && lat < 20.0 && lon >= 72.6 && lon <= 85.8) return true;

  // Gujarat / Maharashtra / North-Central India (lat 20.0 - 22.5)
  if (lat >= 20.0 && lat < 21.0 && lon >= 72.5 && lon <= 87.2) return true;
  if (lat >= 20.8 && lat <= 23.4 && lon >= 69.3 && lon <= 73.5) return true; // Saurashtra & Kutch
  if (lat >= 21.0 && lat < 22.5 && lon >= 72.0 && lon <= 88.5) return true;

  // North India, Pakistan, Bangladesh mainland (lat >= 22.5)
  if (lat >= 22.5 && lat <= 25.5) {
    if (lon >= 68.8 && lon <= 89.4) return true;
  }

  // Myanmar / Arakan coast in northeast
  if (lat >= 15.0 && lat <= 22.0 && lon >= 92.2) return true;

  return false;
}

/**
 * Converts a 2D grid matrix of numbers/nulls into an HTML Canvas element
 */
export function gridToCanvas(
  values: (number | null)[][],
  minVal: number,
  maxVal: number,
  paletteName: string = "thermal",
  scaleType: "linear" | "log" = "linear",
  targetWidth: number = 256,
  targetHeight: number = 256
): HTMLCanvasElement {
  const rows = values.length;
  const cols = values[0]?.length || 0;

  const rawCanvas = document.createElement("canvas");
  rawCanvas.width = cols;
  rawCanvas.height = rows;
  const ctx = rawCanvas.getContext("2d");

  if (!ctx || rows === 0 || cols === 0) return rawCanvas;

  const imgData = ctx.createImageData(cols, rows);
  const data = imgData.data;

  // Map 2D values (lat rows: 0=South [6°N], rows-1=North [25°N])
  // On canvas: y=0 is North, y=rows-1 is South
  for (let r = 0; r < rows; r++) {
    const canvasY = rows - 1 - r;
    const rowValues = values[r];
    if (!rowValues) continue;

    const lat = 6.0 + (r / Math.max(1, rows - 1)) * (25.0 - 6.0);

    for (let c = 0; c < cols; c++) {
      const lon = 68.0 + (c / Math.max(1, cols - 1)) * (90.0 - 68.0);
      const val = rowValues[c];
      const pixelIndex = (canvasY * cols + c) * 4;

      // Soft edge vignette to avoid harsh square boundaries in open ocean
      const edgeMargin = 5;
      const distEdge = Math.min(c, cols - 1 - c, r, rows - 1 - r);
      const edgeFactor = Math.min(1.0, Math.max(0.1, distEdge / edgeMargin));

      if (val === null || isNaN(val) || isSubcontinentLand(lat, lon)) {
        data[pixelIndex] = 0;
        data[pixelIndex + 1] = 0;
        data[pixelIndex + 2] = 0;
        data[pixelIndex + 3] = 0;
      } else {
        const norm = normalizeValue(val, minVal, maxVal, scaleType);
        const dynamicAlpha = Math.round(185 * edgeFactor);
        const [red, green, blue, alpha] = interpolateColor(norm, paletteName, dynamicAlpha);
        data[pixelIndex] = red;
        data[pixelIndex + 1] = green;
        data[pixelIndex + 2] = blue;
        data[pixelIndex + 3] = alpha;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Bicubic upscaling
  const smoothCanvas = document.createElement("canvas");
  smoothCanvas.width = targetWidth;
  smoothCanvas.height = targetHeight;
  const smoothCtx = smoothCanvas.getContext("2d");
  if (smoothCtx) {
    smoothCtx.imageSmoothingEnabled = true;
    smoothCtx.imageSmoothingQuality = "high";
    smoothCtx.drawImage(rawCanvas, 0, 0, targetWidth, targetHeight);
    return smoothCanvas;
  }

  return rawCanvas;
}
