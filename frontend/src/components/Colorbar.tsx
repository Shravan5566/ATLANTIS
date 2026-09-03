"use client";

import React from "react";
import { ManifestResponse } from "@/lib/api";

interface ColorbarProps {
  manifest?: ManifestResponse;
  selectedVariable: string;
}

export default function Colorbar({ manifest, selectedVariable }: ColorbarProps) {
  const meta = manifest?.variables[selectedVariable] || {
    display_name: selectedVariable,
    units: "",
    palette: "thermal",
    min: 0,
    max: 100,
  };

  // Gradient definitions per palette
  const getGradientClass = (palette: string) => {
    switch (palette) {
      case "thermal":
        // Navy -> Cyan -> Green -> Yellow -> Red
        return "bg-gradient-to-r from-[#030d40] via-[#00d2ff] via-[#38ef7d] via-[#f9d423] to-[#ff2a2a]";
      case "haline":
        // Deep blue -> Teal -> Cyan -> Mint -> Light Gold
        return "bg-gradient-to-r from-[#001040] via-[#005f73] via-[#0a9396] via-[#94d2bd] to-[#e9d8a6]";
      case "coolwarm":
        // Deep blue -> Light gray -> Vibrant Red
        return "bg-gradient-to-r from-[#2166ac] via-[#f7f7f7] to-[#b2182b]";
      case "viridis":
      default:
        // Purple -> Teal -> Emerald -> Yellow
        return "bg-gradient-to-r from-[#440154] via-[#31688e] via-[#35b779] to-[#fde725]";
    }
  };

  const steps = 5;
  const minVal = meta.min;
  const maxVal = meta.max;
  const ticks = Array.from({ length: steps }, (_, i) => {
    const val = minVal + ((maxVal - minVal) / (steps - 1)) * i;
    return val.toFixed(1);
  });

  return (
    <div className="fixed top-20 right-4 z-30 ocean-glass rounded-xl p-3 border border-cyan-500/20 shadow-xl max-w-xs w-72">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-semibold text-slate-200">{meta.display_name}</span>
        <span className="font-mono text-cyan-300 font-bold text-[11px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30">
          {meta.units}
        </span>
      </div>

      {/* Color gradient bar */}
      <div className={`h-3 w-full rounded-md shadow-inner border border-black/30 ${getGradientClass(meta.palette)}`} />

      {/* Tick values */}
      <div className="flex justify-between text-[10px] text-slate-300 font-mono mt-1">
        {ticks.map((t, idx) => (
          <span key={idx} className={idx === 0 || idx === ticks.length - 1 ? "font-bold text-cyan-300" : ""}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
