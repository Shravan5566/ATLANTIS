/**
 * lib/colors.ts - Scientific oceanographic color palettes, normalization, and canvas rasterization.
 *
 * Generates smooth, publication-quality sea-surface temperature and ocean field heatmaps
 * using bilinear interpolation, natural coastline blending, and edge feathering.
 */

export interface ColorStop {
  pos: number;
  r: number;
  g: number;
  b: number;
}

export const PALETTES: Record<string, ColorStop[]> = {
  // Thermal: Satellite Sea Surface Temperature standard (NOAA / Copernicus SST)
  // Deep oceanic blue -> Azure -> Sky cyan -> Emerald sea green -> Lime -> Gold -> Amber -> Coral red -> Ruby
  thermal: [
    { pos: 0.0, r: 10, g: 28, b: 84 },
    { pos: 0.12, r: 0, g: 85, b: 180 },
    { pos: 0.25, r: 0, g: 170, b: 225 },
    { pos: 0.38, r: 16, g: 185, b: 129 },
    { pos: 0.50, r: 132, g: 204, b: 22 },
    { pos: 0.65, r: 250, g: 204, b: 21 },
    { pos: 0.78, r: 249, g: 115, b: 22 },
    { pos: 0.90, r: 239, g: 68, b: 68 },
    { pos: 1.0, r: 190, g: 18, b: 60 },
  ],
  // Turbo: Google Turbo colormap (Perceptually uniform, rich contrast)
  turbo: [
    { pos: 0.0, r: 48, g: 18, b: 59 },
    { pos: 0.15, r: 70, g: 90, b: 215 },
    { pos: 0.30, r: 27, g: 178, b: 230 },
    { pos: 0.45, r: 74, g: 228, b: 130 },
    { pos: 0.60, r: 194, g: 223, b: 35 },
    { pos: 0.75, r: 253, g: 160, b: 37 },
    { pos: 0.90, r: 230, g: 65, b: 25 },
    { pos: 1.0, r: 122, g: 4, b: 3 },
  ],
  // Haline: Salinity / Haline scale (Deep oceanic blue -> Teal -> Mint -> Pale sand)
  haline: [
    { pos: 0.0, r: 0, g: 16, b: 64 },
    { pos: 0.25, r: 0, g: 95, b: 115 },
    { pos: 0.50, r: 10, g: 147, b: 150 },
    { pos: 0.75, r: 148, g: 210, b: 189 },
    { pos: 1.0, r: 233, g: 216, b: 166 },
  ],
  // CoolWarm: Anomaly / Divergent scale
  coolwarm: [
    { pos: 0.0, r: 33, g: 102, b: 172 },
    { pos: 0.50, r: 247, g: 247, b: 247 },
    { pos: 1.0, r: 178, g: 24, b: 43 },
  ],
  // Viridis: Perceptually uniform scientific standard
  viridis: [
    { pos: 0.0, r: 68, g: 1, b: 84 },
    { pos: 0.25, r: 49, g: 104, b: 142 },
    { pos: 0.50, r: 53, g: 183, b: 121 },
    { pos: 0.75, r: 181, g: 222, b: 43 },
    { pos: 1.0, r: 253, g: 231, b: 37 },
  ],
  // Plasma: High-energy violet to warm gold
  plasma: [
    { pos: 0.0, r: 13, g: 8, b: 135 },
    { pos: 0.30, r: 156, g: 23, b: 158 },
    { pos: 0.60, r: 237, g: 105, b: 93 },
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
    const offset = Math.max(0, val - minVal);
    return Math.log1p(offset) / Math.log1p(range);
  }
  return Math.max(0, Math.min(1, (val - minVal) / range));
}

/**
 * Returns [r, g, b, a] for a normalized value t between 0.0 and 1.0
 */
export function interpolateColor(
  t: number,
  paletteName: string = "thermal",
  alpha: number = 210
): [number, number, number, number] {
  const stops = PALETTES[paletteName] || PALETTES.thermal;
  const clampedT = Math.max(0, Math.min(1, t));

  for (let i = 0; i < stops.length - 1; i++) {
    const s1 = stops[i];
    const s2 = stops[i + 1];
    if (clampedT >= s1.pos && clampedT <= s2.pos) {
      const span = s2.pos - s1.pos;
      const factor = span > 0 ? (clampedT - s1.pos) / span : 0;
      // Smooth cubic interpolation for natural, continuous gradient
      const t3 = factor * factor * (3 - 2 * factor);
      const r = Math.round(s1.r + (s2.r - s1.r) * t3);
      const g = Math.round(s1.g + (s2.g - s1.g) * t3);
      const b = Math.round(s1.b + (s2.b - s1.b) * t3);
      return [r, g, b, alpha];
    }
  }

  const last = stops[stops.length - 1];
  return [last.r, last.g, last.b, alpha];
}

/**
 * Converts a 2D grid matrix of numbers/nulls into an HTML Canvas element
 * using bilinear interpolation, land masking, and boundary feathering.
 */
export function gridToCanvas(
  values: (number | null)[][],
  minVal: number,
  maxVal: number,
  paletteName: string = "thermal",
  scaleType: "linear" | "log" = "linear",
  targetWidth: number = 1024,
  targetHeight: number = 1024,
  landGeoJson?: any
): HTMLCanvasElement {
  const rows = values.length;
  const cols = values[0]?.length || 0;

  const outW = Math.max(targetWidth, 512);
  const outH = Math.max(targetHeight, 512);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");

  if (!ctx || rows === 0 || cols === 0) return canvas;

  const imgData = ctx.createImageData(outW, outH);
  const data = imgData.data;

  // Outer boundary feathering radius (softens open ocean rectangular edges)
  const featherPx = 18;

  for (let py = 0; py < outH; py++) {
    // Canvas y=0 is North (lat 25°N, row rows-1)
    // Canvas y=outH-1 is South (lat 6°N, row 0)
    const latFrac = 1.0 - py / (outH - 1);
    const gridRow = latFrac * (rows - 1);

    const y0 = Math.floor(gridRow);
    const y1 = Math.min(y0 + 1, rows - 1);
    const dy = gridRow - y0;

    for (let px = 0; px < outW; px++) {
      // Canvas x=0 is West (lon 68°E, col 0)
      // Canvas x=outW-1 is East (lon 90°E, col cols-1)
      const lonFrac = px / (outW - 1);
      const gridCol = lonFrac * (cols - 1);

      const x0 = Math.floor(gridCol);
      const x1 = Math.min(x0 + 1, cols - 1);
      const dx = gridCol - x0;

      const w00 = (1 - dx) * (1 - dy);
      const w10 = dx * (1 - dy);
      const w01 = (1 - dx) * dy;
      const w11 = dx * dy;

      const v00 = values[y0]?.[x0];
      const v10 = values[y0]?.[x1];
      const v01 = values[y1]?.[x0];
      const v11 = values[y1]?.[x1];

      let waterWeight = 0;
      let weightedSum = 0;

      if (v00 !== null && v00 !== undefined && !isNaN(v00)) {
        waterWeight += w00;
        weightedSum += v00 * w00;
      }
      if (v10 !== null && v10 !== undefined && !isNaN(v10)) {
        waterWeight += w10;
        weightedSum += v10 * w10;
      }
      if (v01 !== null && v01 !== undefined && !isNaN(v01)) {
        waterWeight += w01;
        weightedSum += v01 * w01;
      }
      if (v11 !== null && v11 !== undefined && !isNaN(v11)) {
        waterWeight += w11;
        weightedSum += v11 * w11;
      }

      const pixelIndex = (py * outW + px) * 4;

      // Land masking: if cell is mostly land, keep transparent so terrain shows pristine
      if (waterWeight < 0.45) {
        data[pixelIndex] = 0;
        data[pixelIndex + 1] = 0;
        data[pixelIndex + 2] = 0;
        data[pixelIndex + 3] = 0;
        continue;
      }

      const val = weightedSum / waterWeight;

      // Smooth anti-aliased coastline transition
      const coastFactor = Math.min(1.0, Math.max(0.0, (waterWeight - 0.45) / 0.35));
      const smoothCoast = coastFactor * coastFactor * (3 - 2 * coastFactor);

      // Edge feathering to eliminate harsh rectangle cutoff in open sea
      const distLeft = px;
      const distRight = outW - 1 - px;
      const distTop = py;
      const distBottom = outH - 1 - py;
      const distEdge = Math.min(distLeft, distRight, distTop, distBottom);
      const edgeFactor = Math.min(1.0, distEdge / featherPx);
      const smoothEdge = edgeFactor * edgeFactor * (3 - 2 * edgeFactor);

      const norm = normalizeValue(val, minVal, maxVal, scaleType);
      const baseAlpha = 210;
      const finalAlpha = Math.round(baseAlpha * smoothCoast * smoothEdge);

      const [red, green, blue] = interpolateColor(norm, paletteName, finalAlpha);

      data[pixelIndex] = red;
      data[pixelIndex + 1] = green;
      data[pixelIndex + 2] = blue;
      data[pixelIndex + 3] = finalAlpha;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Vector Coastline Punch-Out:
  // Uses authentic country vector polygons to razor-cut land from the ocean raster
  if (landGeoJson && landGeoJson.features) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0, 0, 0, 1.0)";

    for (const feat of landGeoJson.features) {
      const geom = feat.geometry;
      if (!geom) continue;
      const polys =
        geom.type === "MultiPolygon"
          ? geom.coordinates
          : geom.type === "Polygon"
          ? [geom.coordinates]
          : [];

      for (const poly of polys) {
        if (!poly || poly.length === 0) continue;
        ctx.beginPath();
        for (const ring of poly) {
          if (!ring || ring.length < 3) continue;
          for (let i = 0; i < ring.length; i++) {
            const lon = ring[i][0];
            const lat = ring[i][1];
            // Coordinate mapping: Bounding box 68.0° to 90.0° Lon, 6.0° to 25.0° Lat
            const px = ((lon - 68.0) / (90.0 - 68.0)) * (outW - 1);
            const py = (1.0 - (lat - 6.0) / (25.0 - 6.0)) * (outH - 1);
            if (i === 0) {
              ctx.moveTo(px, py);
            } else {
              ctx.lineTo(px, py);
            }
          }
          ctx.closePath();
        }
        ctx.fill();
      }
    }
    ctx.restore();
  }

  return canvas;
}
