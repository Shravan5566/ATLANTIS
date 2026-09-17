"use client";

import React, { useState } from "react";
import { ManifestResponse } from "@/lib/api";
import { Settings, RotateCcw, Palette, Scale, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

export interface ColorbarConfig {
  palette: string;
  scaleType: "linear" | "log";
  min: number;
  max: number;
}

interface ColorbarProps {
  manifest?: ManifestResponse;
  selectedVariable: string;
  config: ColorbarConfig;
  sliceRange?: { min: number; max: number };
  onChangeConfig: (newConfig: ColorbarConfig) => void;
}

const AVAILABLE_PALETTES = [
  {
    id: "thermal",
    name: "Thermal (SST)",
    gradient: "from-[#0a1c54] via-[#00a6fb] via-[#10b981] via-[#facc15] via-[#f97316] to-[#be123c]",
  },
  {
    id: "turbo",
    name: "Turbo",
    gradient: "from-[#30123b] via-[#1bb2e6] via-[#4ae482] via-[#fdb425] to-[#7a0403]",
  },
  {
    id: "haline",
    name: "Haline",
    gradient: "from-[#001040] via-[#0a9396] via-[#94d2bd] to-[#e9d8a6]",
  },
  {
    id: "coolwarm",
    name: "Cool-Warm",
    gradient: "from-[#2166ac] via-[#f7f7f7] to-[#b2182b]",
  },
  {
    id: "viridis",
    name: "Viridis",
    gradient: "from-[#440154] via-[#31688e] via-[#35b779] to-[#fde725]",
  },
  {
    id: "plasma",
    name: "Plasma",
    gradient: "from-[#0d0887] via-[#9c179e] via-[#ed695d] to-[#f0f921]",
  },
];

export default function Colorbar({
  manifest,
  selectedVariable,
  config,
  sliceRange,
  onChangeConfig,
}: ColorbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const meta = manifest?.variables[selectedVariable] || {
    display_name: selectedVariable,
    units: "",
    palette: "thermal",
    min: 0,
    max: 30,
  };

  const handleResetToSlice = () => {
    if (sliceRange) {
      onChangeConfig({
        ...config,
        min: sliceRange.min,
        max: sliceRange.max,
      });
    }
  };

  const handleResetToGlobal = () => {
    onChangeConfig({
      ...config,
      min: meta.min,
      max: meta.max,
    });
  };

  const handlePaletteSelect = (pal: string) => {
    onChangeConfig({ ...config, palette: pal });
  };

  const handleScaleToggle = (scale: "linear" | "log") => {
    onChangeConfig({ ...config, scaleType: scale });
  };

  const handleMinChange = (val: number) => {
    if (!isNaN(val) && val < config.max) {
      onChangeConfig({ ...config, min: val });
    }
  };

  const handleMaxChange = (val: number) => {
    if (!isNaN(val) && val > config.min) {
      onChangeConfig({ ...config, max: val });
    }
  };

  // Find active gradient css class
  const activePal = AVAILABLE_PALETTES.find((p) => p.id === config.palette) || AVAILABLE_PALETTES[0];

  // Calculate ticks
  const steps = 5;
  const ticks = Array.from({ length: steps }, (_, i) => {
    if (config.scaleType === "log") {
      const range = config.max - config.min;
      const t = i / (steps - 1);
      const logVal = config.min + Math.expm1(t * Math.log1p(range));
      return logVal.toFixed(1);
    } else {
      const val = config.min + ((config.max - config.min) / (steps - 1)) * i;
      return val.toFixed(1);
    }
  });

  return (
    <div className="fixed top-20 right-4 z-40 ocean-glass rounded-2xl p-3.5 shadow-2xl max-w-xs w-76 sm:w-80 transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between text-xs mb-2">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
          <span>{meta.display_name}</span>
          <span className="font-mono text-sky-300 font-bold text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-400/25 shadow-sm">
            {meta.units}
          </span>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          title="Customize Colorbar Scale & Palette"
          className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-[11px] ${
            isOpen
              ? "ocean-glass-active text-sky-300"
              : "ocean-glass-interactive text-slate-400 hover:text-slate-200"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Main Gradient Bar */}
      <div
        className={`h-3 w-full rounded-md shadow-inner border border-white/[0.1] bg-gradient-to-r ${activePal.gradient}`}
      />

      {/* Tick Values */}
      <div className="flex justify-between text-[10px] text-slate-300 font-mono mt-1">
        {ticks.map((t, idx) => (
          <span key={idx} className={idx === 0 || idx === ticks.length - 1 ? "font-bold text-sky-300" : ""}>
            {t}
          </span>
        ))}
      </div>

      {/* Interactive Editor Drawer (Collapsible) */}
      {isOpen && (
        <div className="mt-3 pt-3 border-t border-white/[0.08] space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 text-xs">
          {/* 1. Palette Selector */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              <Palette className="w-3 h-3 text-sky-400" />
              <span>Scientific Color Palette</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {AVAILABLE_PALETTES.map((pal) => (
                <button
                  key={pal.id}
                  onClick={() => handlePaletteSelect(pal.id)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    config.palette === pal.id
                      ? "ocean-glass-active text-white"
                      : "ocean-glass-interactive text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-r ${pal.gradient} shrink-0`} />
                  <span>{pal.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Scale Type: Linear vs Log */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              <Scale className="w-3 h-3 text-sky-400" />
              <span>Normalization Scale</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleScaleToggle("linear")}
                className={`py-1 px-2 rounded-lg text-[11px] font-semibold transition-all ${
                  config.scaleType === "linear"
                    ? "ocean-glass-active text-white"
                    : "ocean-glass-interactive text-slate-400 hover:text-slate-200"
                }`}
              >
                Linear Scale
              </button>
              <button
                onClick={() => handleScaleToggle("log")}
                className={`py-1 px-2 rounded-lg text-[11px] font-semibold transition-all ${
                  config.scaleType === "log"
                    ? "ocean-glass-active text-white"
                    : "ocean-glass-interactive text-slate-400 hover:text-slate-200"
                }`}
              >
                Logarithmic (log1p)
              </button>
            </div>
          </div>

          {/* 3. Range Calibration Presets & Inputs */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              <span>Calibration Presets</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <button
                onClick={handleResetToSlice}
                disabled={!sliceRange}
                className="flex items-center justify-center gap-1 py-1 px-2 rounded-lg ocean-glass-interactive text-sky-300 hover:text-white text-[10px] font-medium transition-all disabled:opacity-50"
                title="Calibrate color range to active depth layer"
              >
                <Sparkles className="w-2.5 h-2.5 text-sky-400" />
                <span>Auto: Active Layer</span>
              </button>
              <button
                onClick={handleResetToGlobal}
                className="flex items-center justify-center gap-1 py-1 px-2 rounded-lg ocean-glass-interactive text-slate-300 hover:text-white text-[10px] font-medium transition-all"
                title="Use full column 3D volume range"
              >
                <RotateCcw className="w-2.5 h-2.5 text-slate-400" />
                <span>Full Volume</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-slate-400 mb-0.5">Min ({meta.units}):</label>
                <input
                  type="number"
                  step={0.5}
                  value={config.min}
                  onChange={(e) => handleMinChange(parseFloat(e.target.value))}
                  className="w-full bg-slate-900/80 border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-sky-400/50"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400 mb-0.5">Max ({meta.units}):</label>
                <input
                  type="number"
                  step={0.5}
                  value={config.max}
                  onChange={(e) => handleMaxChange(parseFloat(e.target.value))}
                  className="w-full bg-slate-900/80 border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-sky-400/50"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
