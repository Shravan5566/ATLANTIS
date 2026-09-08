/**
 * lib/api.ts - Typed API client for ATLANTIS backend
 * Maps exactly to the FastAPI backend models in /backend/main.py
 */

export function getApiBase(): string {
  if (
    process.env.NEXT_PUBLIC_API_URL &&
    process.env.NEXT_PUBLIC_API_URL.trim() !== ""
  ) {
    return process.env.NEXT_PUBLIC_API_URL.trim();
  }
  if (typeof window !== "undefined") {
    // Only in local Next.js dev server mode
    if (window.location.hostname === "localhost" && window.location.port === "3000") {
      return "http://localhost:8000";
    }
    // In production (Render, custom domain, etc.) use same-origin relative URLs
    return "";
  }
  return "";
}

export interface BoundingBox {
  min_lon: number;
  max_lon: number;
  min_lat: number;
  max_lat: number;
}

export interface GridShape {
  lat_count: number;
  lon_count: number;
}

export interface VariableMeta {
  display_name: string;
  units: string;
  palette: string;
  min: number;
  max: number;
}

export interface ManifestResponse {
  title: string;
  bounding_box: BoundingBox;
  grid_shape: GridShape;
  lat_grid: number[];
  lon_grid: number[];
  depth_levels: number[];
  timesteps: string[];
  variables: Record<string, VariableMeta>;
}

export interface FieldTileResponse {
  variable: string;
  time_index: number;
  time: string;
  depth_index: number;
  depth: number;
  lat_grid: number[];
  lon_grid: number[];
  values: (number | null)[][];
}

export interface ArgoPositionItem {
  float_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  cycle_number: number;
  min_depth: number;
  max_depth: number;
  total_profile_levels: number;
  total_historical_records: number;
  is_demo_data: boolean;
}

export interface ArgoProfileItem {
  float_id: string;
  cycle_number: number;
  timestamp: string;
  latitude: number;
  longitude: number;
  depth: number;
  temperature: number | null;
  salinity: number | null;
  oxygen: number | null;
  chlorophyll: number | null;
  is_demo_data?: boolean;
}

export interface GliderPoint {
  lat: number;
  lon: number;
  time: string;
  depth: number;
  temperature: number | null;
  salinity: number | null;
}

export interface GliderTrackItem {
  glider_id: string;
  demo_glider_outside_eez: boolean;
  total_raw_points: number;
  sampled_points: number;
  time_start?: string;
  time_end?: string;
  points: GliderPoint[];
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  data_foundation: {
    manifest: boolean;
    argo_positions: boolean;
    argo_profiles: boolean;
    glider_tracks: boolean;
  };
}

async function fetchJson<T>(endpoint: string): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`API Error [${res.status}] ${res.statusText}: ${errorText}`);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<HealthResponse> {
  return fetchJson<HealthResponse>("/api/health");
}

export async function getManifest(): Promise<ManifestResponse> {
  return fetchJson<ManifestResponse>("/api/manifest");
}

export async function getField(
  variable: string,
  timeIndex: number = 0,
  depthIndex: number = 0
): Promise<FieldTileResponse> {
  return fetchJson<FieldTileResponse>(
    `/api/field?variable=${encodeURIComponent(variable)}&time=${timeIndex}&depth=${depthIndex}`
  );
}

export async function getArgoPositions(): Promise<ArgoPositionItem[]> {
  return fetchJson<ArgoPositionItem[]>("/api/argo/positions");
}

export async function getArgoProfile(floatId: string): Promise<ArgoProfileItem[]> {
  return fetchJson<ArgoProfileItem[]>(`/api/argo/profile/${encodeURIComponent(floatId)}`);
}

export async function getGliderTracks(): Promise<GliderTrackItem[]> {
  return fetchJson<GliderTrackItem[]>("/api/glider/tracks");
}
