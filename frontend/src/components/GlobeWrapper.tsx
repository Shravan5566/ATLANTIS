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
}

export default function GlobeWrapper(props: GlobeWrapperProps) {
  const [GlobeComponent, setGlobeComponent] = useState<React.ComponentType<any> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    import("./Globe")
      .then((mod) => {
        setGlobeComponent(() => mod.default);
      })
      .catch((err) => {
        console.error("FAILED TO LOAD GLOBE MODULE:", err);
        setLoadError(err?.message || String(err));
      });
  }, []);

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-red-400 font-mono text-sm p-6 text-center">
        <div className="text-lg font-bold text-red-300 mb-2">3D Geospatial Engine Initialization Error</div>
        <div className="text-xs text-red-400/80 bg-red-950/40 p-3 rounded border border-red-800 max-w-xl overflow-auto text-left font-mono">
          {loadError}
        </div>
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
