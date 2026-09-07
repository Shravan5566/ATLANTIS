"use client";

import React, { useEffect, useState } from "react";
import { Compass, Layers, Activity, Crosshair, Globe2 } from "lucide-react";
import { hoverStore, HoverInfo, initialHoverInfo } from "@/lib/hoverStore";

export type { HoverInfo };

interface InfoBarProps {
  info?: HoverInfo;
}

export default function InfoBar({ info: propInfo }: InfoBarProps) {
  const [storeInfo, setStoreInfo] = useState<HoverInfo>(initialHoverInfo);

  useEffect(() => {
    // If propInfo is provided, we can use it, otherwise subscribe to decoupled store
    if (propInfo) return;
    const unsubscribe = hoverStore.subscribe((newInfo) => {
      setStoreInfo(newInfo);
    });
    return unsubscribe;
  }, [propInfo]);

  const activeInfo = propInfo || storeInfo;

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-10 z-40 ocean-glass border-t border-cyan-500/20 px-4 flex items-center justify-between text-xs text-slate-300 font-mono select-none">
      {/* Left: Cursor coordinates */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-cyan-400">
          <Crosshair className="w-3.5 h-3.5" />
          <span className="text-[11px] text-slate-400 font-sans hidden sm:inline">Cursor:</span>
        </div>

        <div className="flex items-center gap-3">
          <span>
            Lat:{" "}
            <strong className="text-white font-mono">
              {activeInfo.latitude !== null ? `${activeInfo.latitude.toFixed(3)}°N` : "—"}
            </strong>
          </span>
          <span>
            Lon:{" "}
            <strong className="text-white font-mono">
              {activeInfo.longitude !== null ? `${activeInfo.longitude.toFixed(3)}°E` : "—"}
            </strong>
          </span>
        </div>
      </div>

      {/* Center: Inspected Layer / Value */}
      <div className="hidden md:flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            Depth:{" "}
            <strong className="text-cyan-300 font-mono">
              {activeInfo.depth !== null ? `${activeInfo.depth.toFixed(1)} m` : "—"}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-teal-400" />
          <span>
            {activeInfo.variableName || "Value"}:{" "}
            <strong className="text-emerald-300 font-mono">
              {activeInfo.value !== null ? `${activeInfo.value.toFixed(2)} ${activeInfo.variableUnits}` : "—"}
            </strong>
          </span>
        </div>
      </div>

      {/* Right: Target info / Platform & Attribution indicator */}
      <div className="flex items-center gap-3">
        {activeInfo.targetId ? (
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[10px] font-sans">
            Inspecting: <strong className="font-mono">{activeInfo.targetType} #{activeInfo.targetId}</strong>
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <Compass className="w-3 h-3 text-cyan-400" />
            <span className="hidden lg:inline text-slate-400">India EEZ (Arabian Sea · Bay of Bengal · Andaman)</span>
          </span>
        )}

        {/* MarineRegions.org / VLIZ Official License Attribution */}
        <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-slate-700/60 text-[10px] text-slate-500">
          <Globe2 className="w-2.5 h-2.5 text-slate-500" />
          <span>Boundaries: <a href="https://marineregions.org" target="_blank" rel="noreferrer" className="hover:text-cyan-400 underline decoration-slate-600">MarineRegions.org / VLIZ</a> (v12)</span>
        </div>
      </div>
    </footer>
  );
}
