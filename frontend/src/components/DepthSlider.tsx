"use client";

import React from "react";
import { Layers, ArrowDown } from "lucide-react";

interface DepthSliderProps {
  depthLevels: number[];
  depthIndex: number;
  onDepthChange: (index: number) => void;
}

export default function DepthSlider({ depthLevels, depthIndex, onDepthChange }: DepthSliderProps) {
  const currentDepth = depthLevels[depthIndex] ?? 0.5;

  const getDepthLabel = (d: number) => {
    if (d <= 5) return "Sea Surface";
    if (d <= 50) return "Epipelagic / Mixed Layer";
    if (d <= 200) return "Thermocline Transition";
    if (d <= 1000) return "Mesopelagic / Intermediate";
    return "Deep Ocean";
  };

  return (
    <div className="space-y-2.5 p-3.5 rounded-xl ocean-glass-subtle border border-cyan-500/20">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Water Column Depth</span>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/90 border border-cyan-400/40 text-cyan-300 font-mono font-bold text-xs">
          <ArrowDown className="w-3 h-3 text-cyan-400" />
          <span>{currentDepth} m</span>
        </div>
      </div>

      <div className="text-[11px] text-slate-400 italic">
        Layer: <span className="text-teal-300 font-medium">{getDepthLabel(currentDepth)}</span>
      </div>

      {/* Slider */}
      <div className="relative pt-1">
        <input
          type="range"
          min={0}
          max={Math.max(0, depthLevels.length - 1)}
          step={1}
          value={depthIndex}
          onChange={(e) => onDepthChange(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />

        <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
          <span>{depthLevels[0] ?? 0}m (Surface)</span>
          <span>{depthLevels[depthLevels.length - 1] ?? 1000}m</span>
        </div>
      </div>
    </div>
  );
}
