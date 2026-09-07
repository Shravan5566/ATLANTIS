"use client";

import React from "react";
import Image from "next/image";
import { ManifestResponse } from "@/lib/api";
import VariableSelector from "./VariableSelector";
import DepthSlider from "./DepthSlider";
import TimeSlider from "./TimeSlider";
import {
  Sliders,
  Eye,
  Navigation,
  X,
  Anchor,
  MapPin,
  Box,
  Layers as LayersIcon,
  Maximize2,
} from "lucide-react";

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
  onFlyToRegion: (lat: number, lon: number, height: number, pitch?: number, heading?: number) => void;
  viewMode: "single" | "volumetric";
  onViewModeChange: (mode: "single" | "volumetric") => void;
  verticalExaggeration: number;
  onExaggerationChange: (val: number) => void;
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
  viewMode,
  onViewModeChange,
  verticalExaggeration,
  onExaggerationChange,
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
        <div className="flex items-center gap-2.5 text-cyan-300 font-bold text-sm tracking-wider uppercase">
          <div className="relative w-5 h-5 flex items-center justify-center">
            <Image
              src="/atlantis-icon.png"
              alt="ATLANTIS"
              width={20}
              height={18}
              className="w-4.5 h-auto object-contain drop-shadow-[0_0_8px_rgba(0,210,255,0.6)]"
            />
          </div>
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

        {/* 2. Visualization Mode Switch: 2D Single Slice vs 3D Volumetric Water Column */}
        <div className="space-y-2 p-3 rounded-xl ocean-glass-subtle border border-cyan-500/20">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold uppercase tracking-wider">
            <span>Display Mode</span>
            <span className="text-[10px] text-cyan-400 font-mono font-bold">
              {viewMode === "volumetric" ? "3D Multi-Layer" : "2D Single Layer"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onViewModeChange("single")}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all border ${
                viewMode === "single"
                  ? "bg-cyan-950/90 border-cyan-400 text-white shadow-md shadow-cyan-900/40"
                  : "bg-slate-900/60 border-slate-700/60 text-slate-400 hover:text-white"
              }`}
            >
              <LayersIcon className="w-3.5 h-3.5" />
              <span>Single Depth</span>
            </button>

            <button
              onClick={() => {
                onViewModeChange("volumetric");
                // Automatically tilt camera to showcase the 3D stack
                onFlyToRegion(15.0, 78.0, 3200000, -45, 10);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all border ${
                viewMode === "volumetric"
                  ? "bg-gradient-to-r from-teal-900 to-cyan-950 border-emerald-400 text-white shadow-md shadow-teal-900/50 ring-1 ring-emerald-400/40"
                  : "bg-slate-900/60 border-slate-700/60 text-slate-400 hover:text-white"
              }`}
            >
              <Box className="w-3.5 h-3.5 text-emerald-400" />
              <span>3D Volumetric</span>
            </button>
          </div>

          {/* If Volumetric Mode: Show Vertical Exaggeration Slider & 3D Tilt Helper */}
          {viewMode === "volumetric" ? (
            <div className="pt-2 space-y-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-medium">Vertical Exaggeration:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-mono font-bold">
                  {verticalExaggeration}x
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={400}
                step={25}
                value={verticalExaggeration}
                onChange={(e) => onExaggerationChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>50x</span>
                <span>Stack: 0m, 50m, 200m, 1000m</span>
                <span>400x</span>
              </div>

              <button
                onClick={() => onFlyToRegion(14.5, 78.5, 3000000, -38, 15)}
                className="w-full mt-1 py-1.5 px-2 rounded-lg bg-teal-950/70 hover:bg-teal-900/90 border border-teal-500/40 text-[11px] text-teal-300 flex items-center justify-center gap-1.5 transition-all"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Perspective 3D Water Column Tilt</span>
              </button>
            </div>
          ) : (
            /* If Single Mode: Show standard Depth Slider */
            <DepthSlider
              depthLevels={depthLevels}
              depthIndex={depthIndex}
              onDepthChange={onDepthChange}
            />
          )}
        </div>

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
              onClick={() => onFlyToRegion(15.5, 79.0, 2600000, -85, 0)}
              className="px-2 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-[11px] text-slate-300 hover:text-white transition-all text-center"
            >
              🇮🇳 Entire EEZ
            </button>
            <button
              onClick={() => onFlyToRegion(16.0, 71.5, 1500000, -55, 30)}
              className="px-2 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-[11px] text-slate-300 hover:text-white transition-all text-center"
            >
              🌊 Arabian Sea
            </button>
            <button
              onClick={() => onFlyToRegion(15.0, 86.5, 1600000, -55, -30)}
              className="px-2 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-[11px] text-slate-300 hover:text-white transition-all text-center"
            >
              🌀 Bay of Bengal
            </button>
            <button
              onClick={() => onFlyToRegion(10.5, 73.5, 1100000, -60, 20)}
              className="px-2 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-[11px] text-slate-300 hover:text-white transition-all text-center"
            >
              🏝️ Lakshadweep
            </button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-950/70 border-t border-cyan-500/20 text-[10px] text-slate-400 flex items-center justify-center gap-2 font-mono">
        <Image
          src="/atlantis-icon.png"
          alt="ATLANTIS"
          width={14}
          height={13}
          className="w-3.5 h-auto object-contain opacity-60"
        />
        <span>INCOIS Numerical Model · 0.083° Grid</span>
      </div>
    </aside>
  );
}
