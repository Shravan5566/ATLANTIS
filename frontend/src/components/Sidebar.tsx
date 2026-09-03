"use client";

import React from "react";
import { ManifestResponse } from "@/lib/api";
import VariableSelector from "./VariableSelector";
import DepthSlider from "./DepthSlider";
import TimeSlider from "./TimeSlider";
import { Sliders, Eye, Navigation, X, Anchor, MapPin } from "lucide-react";

interface SidebarProps {
  manifest?: ManifestResponse;
  selectedVariable: string;
  onSelectVariable: (variable: string) => void;
  depthIndex: number;
  onDepthChange: (index: number) => void;
  timeIndex: number;
  onTimeChange: (index: number) => void;
  showArgo: boolean;
  onToggleArgo: () => void;
  showGliders: boolean;
  onToggleGliders: () => void;
  onFlyToRegion: (lat: number, lon: number, height: number) => void;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
}

export default function Sidebar({
  manifest,
  selectedVariable,
  onSelectVariable,
  depthIndex,
  onDepthChange,
  timeIndex,
  onTimeChange,
  showArgo,
  onToggleArgo,
  showGliders,
  onToggleGliders,
  onFlyToRegion,
  isOpen,
  onClose,
  isLoading,
}: SidebarProps) {
  const depthLevels = manifest?.depth_levels || [0.5, 5, 10, 20, 50, 100, 200, 500, 1000];
  const timesteps = manifest?.timesteps || ["2026-09-01T00:00:00Z"];

  return (
    <aside
      className={`fixed top-16 left-0 bottom-10 w-80 sm:w-88 z-40 ocean-glass border-r border-cyan-500/20 flex flex-col transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm tracking-wider uppercase">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>Ocean Controls</span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Control Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* 1. Variable Selector */}
        <VariableSelector
          manifest={manifest}
          selectedVariable={selectedVariable}
          onSelectVariable={onSelectVariable}
          isLoading={isLoading}
        />

        {/* 2. Depth Slider */}
        <DepthSlider
          depthLevels={depthLevels}
          depthIndex={depthIndex}
          onDepthChange={onDepthChange}
        />

        {/* 3. Time Slider & Animation */}
        <TimeSlider
          timesteps={timesteps}
          timeIndex={timeIndex}
          onTimeChange={onTimeChange}
        />

        {/* 4. In-Situ Observational Layers Toggle */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-semibold uppercase tracking-wider">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>In-Situ Overlays</span>
          </div>

          <div className="space-y-2">
            {/* Argo floats toggle */}
            <button
              onClick={onToggleArgo}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                showArgo
                  ? "bg-cyan-950/70 border-cyan-400/80 text-white shadow-sm shadow-cyan-500/20"
                  : "bg-slate-900/50 border-slate-700/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${showArgo ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-400"}`}>
                  <Anchor className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-[11px]">Argo In-Situ Floats</div>
                  <div className="text-[10px] text-slate-400">50 Real Active Probes</div>
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  showArgo ? "bg-cyan-400 border-cyan-300" : "border-slate-600"
                }`}
              >
                {showArgo && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
              </div>
            </button>

            {/* Glider tracks toggle */}
            <button
              onClick={onToggleGliders}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                showGliders
                  ? "bg-teal-950/70 border-teal-400/80 text-white shadow-sm shadow-teal-500/20"
                  : "bg-slate-900/50 border-slate-700/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${showGliders ? "bg-teal-500/20 text-teal-300" : "bg-slate-800 text-slate-400"}`}>
                  <Navigation className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-[11px]">Ocean Glider Tracks</div>
                  <div className="text-[10px] text-slate-400">Autonomous 3D Dives</div>
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  showGliders ? "bg-teal-400 border-teal-300" : "border-slate-600"
                }`}
              >
                {showGliders && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
              </div>
            </button>
          </div>
        </div>

        {/* 5. Geographic Presets */}
        <div className="space-y-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-semibold uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>EEZ Sub-Basins</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onFlyToRegion(15.5, 79.0, 2600000)}
              className="px-2 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-[11px] text-slate-300 hover:text-white transition-all text-center"
            >
              🇮🇳 Entire EEZ
            </button>
            <button
              onClick={() => onFlyToRegion(16.0, 71.5, 1500000)}
              className="px-2 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-[11px] text-slate-300 hover:text-white transition-all text-center"
            >
              🌊 Arabian Sea
            </button>
            <button
              onClick={() => onFlyToRegion(15.0, 86.5, 1600000)}
              className="px-2 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-[11px] text-slate-300 hover:text-white transition-all text-center"
            >
              🌀 Bay of Bengal
            </button>
            <button
              onClick={() => onFlyToRegion(10.5, 73.5, 1100000)}
              className="px-2 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-[11px] text-slate-300 hover:text-white transition-all text-center"
            >
              🏝️ Lakshadweep
            </button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-950/70 border-t border-cyan-500/20 text-[10px] text-slate-400 text-center font-mono">
        INCOIS Numerical Model · 0.083° Grid
      </div>
    </aside>
  );
}
