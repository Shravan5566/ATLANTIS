"use client";

import React from "react";
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
  Compass,
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
  onToggle?: () => void;
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
  onToggle,
  isLoading,
}: SidebarProps) {
  const depthLevels = manifest?.depth_levels || [0.5, 5, 10, 20, 50, 100, 200, 500, 1000];
  const timesteps = manifest?.timesteps || ["2026-09-01T00:00:00Z"];

  return (
    <aside
      className={`fixed top-16 left-0 bottom-10 w-80 z-40 ocean-glass border-r border-white/[0.08] flex flex-col transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Edge Slide Toggle Handle — Attached directly so it slides seamlessly in 100% sync */}
      <button
        id="btn-sidebar-toggle"
        onClick={onToggle || onClose}
        title={isOpen ? "Hide Ocean Controls" : "Show Ocean Controls"}
        aria-label="Toggle Ocean Controls Sidebar"
        className="absolute left-full top-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-1
          w-5 h-20 rounded-r-xl
          ocean-glass border border-l-0 border-white/[0.1]
          text-slate-300 hover:text-white hover:bg-white/[0.08]
          shadow-lg shadow-black/40 cursor-pointer transition-colors duration-200"
      >
        <svg
          className={`w-3 h-3 transition-transform duration-300 ${isOpen ? "" : "rotate-180"}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span
          className="text-[9px] font-bold tracking-widest uppercase opacity-70"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          {isOpen ? "Hide" : "Controls"}
        </span>
      </button>

      {/* Sidebar Header */}
      <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-100 font-bold text-sm tracking-wider uppercase">
          <Sliders className="w-4 h-4 text-sky-400" />
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
        <div className="space-y-2 p-3 rounded-xl ocean-glass-subtle">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold uppercase tracking-wider">
            <span>Display Mode</span>
            <span className="text-[10px] text-sky-400 font-mono font-bold">
              {viewMode === "volumetric" ? "3D Multi-Layer" : "2D Single Layer"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn-mode-single"
              onClick={() => onViewModeChange("single")}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "single"
                  ? "ocean-glass-active text-white"
                  : "ocean-glass-interactive text-slate-400 hover:text-white"
              }`}
            >
              <LayersIcon className="w-3.5 h-3.5" />
              <span>Single Depth</span>
            </button>

            <button
              id="btn-mode-volumetric"
              onClick={() => {
                onViewModeChange("volumetric");
                // Center camera on the 3D ocean water column with an isometric perspective tilt
                onFlyToRegion(1.5, 74.0, 2600000, -40, 18);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "volumetric"
                  ? "ocean-glass-active text-white"
                  : "ocean-glass-interactive text-slate-400 hover:text-white"
              }`}
            >
              <Box className="w-3.5 h-3.5 text-sky-400" />
              <span>3D Volumetric</span>
            </button>
          </div>

          {/* If Volumetric Mode: Show Vertical Exaggeration Slider & 3D Tilt Helper */}
          {viewMode === "volumetric" ? (
            <div className="pt-2 space-y-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-medium">Vertical Exaggeration:</span>
                <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-400/25 text-sky-300 font-mono font-bold">
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
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>50x</span>
                <span>Stack: 0m, 50m, 200m, 1000m</span>
                <span>400x</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={() => onFlyToRegion(1.5, 74.0, 2600000, -40, 18)}
                  className="py-1.5 px-2 rounded-lg ocean-glass-interactive text-[11px] text-slate-300 hover:text-sky-300 flex items-center justify-center gap-1.5 transition-all"
                  title="3D Oblique Perspective Angle"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>3D Oblique</span>
                </button>
                <button
                  onClick={() => onFlyToRegion(12.0, 57.0, 2200000, -28, 76)}
                  className="py-1.5 px-2 rounded-lg ocean-glass-interactive text-[11px] text-slate-300 hover:text-sky-300 flex items-center justify-center gap-1.5 transition-all"
                  title="3D Side Profile Horizon Angle"
                >
                  <Compass className="w-3 h-3" />
                  <span>Side Profile</span>
                </button>
              </div>
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
            <Eye className="w-3.5 h-3.5 text-sky-400" />
            <span>In-Situ Overlays</span>
          </div>

          <div className="space-y-2">
            {/* Argo floats toggle */}
            <button
              onClick={onToggleArgo}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-all ${
                showArgo
                  ? "ocean-glass-active text-white"
                  : "ocean-glass-interactive text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${showArgo ? "bg-sky-500/20 text-sky-300" : "bg-white/[0.05] text-slate-400"}`}>
                  <Anchor className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-[11px]">Argo In-Situ Floats</div>
                  <div className="text-[10px] text-slate-400">50 Real Active Probes</div>
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  showArgo ? "bg-sky-400 border-sky-300" : "border-slate-600"
                }`}
              >
                {showArgo && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
              </div>
            </button>

            {/* Glider tracks toggle */}
            <button
              onClick={onToggleGliders}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-all ${
                showGliders
                  ? "ocean-glass-active text-white"
                  : "ocean-glass-interactive text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${showGliders ? "bg-amber-500/20 text-amber-300" : "bg-white/[0.05] text-slate-400"}`}>
                  <Navigation className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-[11px]">Ocean Glider Tracks</div>
                  <div className="text-[10px] text-slate-400">Autonomous 3D Dives</div>
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  showGliders ? "bg-amber-400 border-amber-300" : "border-slate-600"
                }`}
              >
                {showGliders && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
              </div>
            </button>
          </div>
        </div>

        {/* 5. Geographic Presets */}
        <div className="space-y-2 pt-1 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-semibold uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span>EEZ Sub-Basins</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onFlyToRegion(15.5, 79.0, 2600000, -85, 0)}
              className="px-2 py-1.5 rounded-lg ocean-glass-interactive text-[11px] text-slate-300 hover:text-white transition-all text-center"
            >
              🇮🇳 Entire EEZ
            </button>
            <button
              onClick={() => onFlyToRegion(16.0, 71.5, 1500000, -55, 30)}
              className="px-2 py-1.5 rounded-lg ocean-glass-interactive text-[11px] text-slate-300 hover:text-white transition-all text-center"
            >
              🌊 Arabian Sea
            </button>
            <button
              onClick={() => onFlyToRegion(15.0, 86.5, 1600000, -55, -30)}
              className="px-2 py-1.5 rounded-lg ocean-glass-interactive text-[11px] text-slate-300 hover:text-white transition-all text-center"
            >
              🌀 Bay of Bengal
            </button>
            <button
              onClick={() => onFlyToRegion(10.5, 73.5, 1100000, -60, 20)}
              className="px-2 py-1.5 rounded-lg ocean-glass-interactive text-[11px] text-slate-300 hover:text-white transition-all text-center"
            >
              🏝️ Lakshadweep
            </button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-950/40 border-t border-white/[0.06] text-[10px] text-slate-400 text-center font-mono">
        <span>INCOIS Numerical Model · 0.083° Grid</span>
      </div>
    </aside>
  );
}
