"use client";

import React from "react";
import { Compass, Layers, Activity, Crosshair } from "lucide-react";

export interface HoverInfo {
  latitude: number | null;
  longitude: number | null;
  depth: number | null;
  value: number | null;
  variableName: string;
  variableUnits: string;
  targetType?: string;
  targetId?: string;
}

interface InfoBarProps {
  info: HoverInfo;
}

export default function InfoBar({ info }: InfoBarProps) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 h-10 z-40 ocean-glass border-t border-cyan-500/20 px-4 flex items-center justify-between text-xs text-slate-300 font-mono">
      {/* Left: Cursor coordinates */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-cyan-400">
          <Crosshair className="w-3.5 h-3.5" />
          <span className="text-[11px] text-slate-400 font-sans hidden sm:inline">Cursor:</span>
        </div>

        <div className="flex items-center gap-3">
          <span>
            Lat:{" "}
            <strong className="text-white">
              {info.latitude !== null ? `${info.latitude.toFixed(3)}°N` : "—"}
            </strong>
          </span>
          <span>
            Lon:{" "}
            <strong className="text-white">
              {info.longitude !== null ? `${info.longitude.toFixed(3)}°E` : "—"}
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
            <strong className="text-cyan-300">
              {info.depth !== null ? `${info.depth.toFixed(1)} m` : "—"}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-teal-400" />
          <span>
            {info.variableName || "Value"}:{" "}
            <strong className="text-emerald-300">
              {info.value !== null ? `${info.value.toFixed(2)} ${info.variableUnits}` : "—"}
            </strong>
          </span>
        </div>
      </div>

      {/* Right: Target info / Platform indicator */}
      <div className="flex items-center gap-2">
        {info.targetId ? (
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[10px] font-sans">
            Inspecting: <strong className="font-mono">{info.targetType} {info.targetId}</strong>
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Compass className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">India EEZ (Arabian Sea & Bay of Bengal)</span>
          </span>
        )}
      </div>
    </footer>
  );
}
