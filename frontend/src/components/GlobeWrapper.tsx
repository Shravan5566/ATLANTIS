"use client";

import React, { useState, useEffect } from "react";
import { HoverInfo } from "./InfoBar";
import { ManifestResponse, ArgoPositionItem, GliderTrackItem } from "@/lib/api";
import { ColorbarConfig } from "./Colorbar";

interface GlobeWrapperProps {
  onHoverChange?: (info: HoverInfo) => void;
  selectedVariable: string;
  depthIndex: number;
  timeIndex: number;
  manifest?: ManifestResponse;
  viewMode: "single" | "volumetric";
  verticalExaggeration: number;
  showArgo: boolean;
  showGliders: boolean;
  onSelectFloat: (float: ArgoPositionItem) => void;
  selectedFloatId?: string;
  onSelectGlider?: (glider: GliderTrackItem) => void;
  selectedGliderId?: string;
  colorbarConfig?: ColorbarConfig;
  cameraTrigger?: { lat: number; lon: number; height: number; pitch?: number; heading?: number; key: number } | null;
  onSliceDataCalculated?: (variable: string, depthIdx: number, min: number, max: number) => void;
  rightPanelOpen?: boolean;
}

export default function GlobeWrapper(props: GlobeWrapperProps) {
  const [GlobeComponent, setGlobeComponent] = useState<React.ComponentType<any> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const MAX_RETRIES = 3;

    const attemptLoad = async (attempt: number): Promise<void> => {
      try {
        const mod = await import("./Globe");
        if (!cancelled) {
          setGlobeComponent(() => mod.default);
        }
      } catch (err: any) {
        console.error(`Globe module load attempt ${attempt}/${MAX_RETRIES} failed:`, err);

        const isChunkError =
          err?.message?.includes("Loading chunk") ||
          err?.message?.includes("Failed to fetch") ||
          err?.message?.includes("loading chunk") ||
          err?.name === "ChunkLoadError";

        if (isChunkError && attempt < MAX_RETRIES) {
          // Exponential backoff: 500ms, 1500ms, 3500ms
          const delay = 500 * Math.pow(2, attempt - 1) + Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (!cancelled) {
            return attemptLoad(attempt + 1);
          }
        } else if (isChunkError) {
          console.warn("Could not load 3D globe module after retries.");
        }

        if (!cancelled) {
          setLoadError(err?.message || String(err));
        }
      }
    };

    attemptLoad(1);
    return () => { cancelled = true; };
  }, []);

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-red-400 font-mono text-sm p-6 text-center">
        <div className="text-lg font-bold text-red-300 mb-2">3D Geospatial Engine Initialization Error</div>
        <div className="text-xs text-red-400/80 bg-red-950/40 p-3 rounded border border-red-800 max-w-xl overflow-auto text-left font-mono mb-4">
          {loadError}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
        >
          Reload Page
        </button>
      </div>
    );
  }

  if (!GlobeComponent) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-cyan-400 font-mono text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span>Loading 3D Geospatial Engine...</span>
        </div>
      </div>
    );
  }

  const Comp = GlobeComponent;
  return <Comp {...props} />;
}
