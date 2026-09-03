"use client";

import React from "react";
import { ManifestResponse } from "@/lib/api";
import { Thermometer, Droplets, Wind, Gauge } from "lucide-react";

interface VariableSelectorProps {
  manifest?: ManifestResponse;
  selectedVariable: string;
  onSelectVariable: (variable: string) => void;
  isLoading?: boolean;
}

export default function VariableSelector({
  manifest,
  selectedVariable,
  onSelectVariable,
  isLoading,
}: VariableSelectorProps) {
  const variables = manifest?.variables || {
    thetao: { display_name: "Sea Water Temperature", units: "°C", palette: "thermal", min: 4, max: 30 },
    so: { display_name: "Sea Water Salinity", units: "PSU", palette: "haline", min: 34, max: 36.5 },
    cur_speed: { display_name: "Current Velocity", units: "m/s", palette: "viridis", min: 0, max: 1.5 },
  };

  const getIcon = (key: string) => {
    switch (key) {
      case "thetao":
        return <Thermometer className="w-4 h-4 text-rose-400" />;
      case "so":
        return <Droplets className="w-4 h-4 text-cyan-400" />;
      case "cur_speed":
      case "uo":
      case "vo":
        return <Wind className="w-4 h-4 text-emerald-400" />;
      default:
        return <Gauge className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-300 font-semibold tracking-wide uppercase">
        <span>Ocean Field Parameter</span>
        {isLoading && <span className="text-cyan-400 text-[10px] animate-pulse">Syncing...</span>}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {Object.entries(variables).map(([key, meta]) => {
          const isSelected = selectedVariable === key;
          return (
            <button
              key={key}
              onClick={() => onSelectVariable(key)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-medium transition-all duration-200 border ${
                isSelected
                  ? "bg-gradient-to-r from-cyan-950/90 to-teal-900/60 border-cyan-400 text-white shadow-md shadow-cyan-900/40 ring-1 ring-cyan-400/40"
                  : "bg-slate-900/60 hover:bg-slate-800/80 border-slate-700/60 text-slate-300 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-700/40">
                  {getIcon(key)}
                </div>
                <div>
                  <div className="font-semibold">{meta.display_name}</div>
                  <div className="text-[10px] text-slate-400">Key: {key}</div>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-950/80 text-cyan-300 border border-cyan-500/20">
                  {meta.units}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
