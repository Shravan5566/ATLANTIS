"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getManifest, ManifestResponse, ArgoPositionItem, GliderTrackItem } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import Colorbar, { ColorbarConfig } from "@/components/Colorbar";
import InfoBar from "@/components/InfoBar";
import GlobeWrapper from "@/components/GlobeWrapper";
import ArgoProfileDrawer from "@/components/ArgoProfileDrawer";
import GliderProfileDrawer from "@/components/GliderProfileDrawer";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [selectedVariable, setSelectedVariable] = useState("thetao");
  const [depthIndex, setDepthIndex] = useState(0);
  const [timeIndex, setTimeIndex] = useState(0);
  const [showArgo, setShowArgo] = useState(true);
  const [showGliders, setShowGliders] = useState(true);

  // Selected In-Situ Platforms for profile inspection
  const [selectedFloat, setSelectedFloat] = useState<ArgoPositionItem | null>(null);
  const [selectedGlider, setSelectedGlider] = useState<GliderTrackItem | null>(null);

  // Volumetric water column states
  const [viewMode, setViewMode] = useState<"single" | "volumetric">("single");
  const [verticalExaggeration, setVerticalExaggeration] = useState(150);

  // Custom Colorbar Settings per variable
  const [customColorbar, setCustomColorbar] = useState<Record<string, ColorbarConfig>>({});
  // Dynamic slice ranges calculated from active data layer
  const [sliceRanges, setSliceRanges] = useState<Record<string, { min: number; max: number }>>({});

  const [cameraTrigger, setCameraTrigger] = useState<{
    lat: number;
    lon: number;
    height: number;
    pitch?: number;
    heading?: number;
    key: number;
  } | null>(null);

  // Fetch Manifest via React Query
  const { data: manifest, isLoading: isManifestLoading } = useQuery<ManifestResponse>({
    queryKey: ["manifest"],
    queryFn: getManifest,
  });

  const currentVariableMeta = manifest?.variables[selectedVariable];

  const handleSliceDataCalculated = useCallback(
    (variable: string, depthIdx: number, sMin: number, sMax: number) => {
      const span = sMax - sMin;
      const step = span > 5 ? 1 : 0.5;
      const niceMin = Math.floor(sMin / step) * step;
      const niceMax = Math.ceil(sMax / step) * step;
      setSliceRanges((prev) => {
        const existing = prev[variable];
        if (existing && existing.min === niceMin && existing.max === niceMax) {
          return prev;
        }
        return {
          ...prev,
          [variable]: {
            min: Number(niceMin.toFixed(1)),
            max: Number(niceMax.toFixed(1)),
          },
        };
      });
    },
    []
  );

  const activeSliceRange = sliceRanges[selectedVariable];
  const defaultMin = activeSliceRange?.min ?? currentVariableMeta?.min ?? 0;
  const defaultMax = activeSliceRange?.max ?? currentVariableMeta?.max ?? 30;

  // Active colorbar settings (custom override or active slice defaults)
  const activeColorbarConfig: ColorbarConfig = customColorbar[selectedVariable] || {
    palette: currentVariableMeta?.palette || "thermal",
    scaleType: "linear",
    min: defaultMin,
    max: defaultMax,
  };

  const handleFlyToRegion = (
    lat: number,
    lon: number,
    height: number,
    pitch: number = -85,
    heading: number = 0
  ) => {
    setCameraTrigger({ lat, lon, height, pitch, heading, key: Date.now() });
  };

  const handleSelectFloat = (fl: ArgoPositionItem) => {
    setSelectedFloat(fl);
    setSelectedGlider(null);
  };

  const handleSelectGlider = (glider: GliderTrackItem) => {
    setSelectedGlider(glider);
    setSelectedFloat(null);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* 1. Top Oceanic Navbar */}
      <Navbar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />

      {/* 2. Left Controls Sidebar */}
      <Sidebar
        manifest={manifest}
        selectedVariable={selectedVariable}
        onSelectVariable={setSelectedVariable}
        depthIndex={depthIndex}
        onDepthChange={setDepthIndex}
        timeIndex={timeIndex}
        onTimeChange={setTimeIndex}
        showArgo={showArgo}
        onToggleArgo={() => setShowArgo(!showArgo)}
        showGliders={showGliders}
        onToggleGliders={() => setShowGliders(!showGliders)}
        onFlyToRegion={handleFlyToRegion}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        verticalExaggeration={verticalExaggeration}
        onExaggerationChange={setVerticalExaggeration}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen((o) => !o)}
        isLoading={isManifestLoading}
      />

      {/* 3. Top-Right Interactive Colorbar Legend & Editor */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          rightPanelOpen
            ? "opacity-100 translate-x-0 pointer-events-auto"
            : "opacity-0 translate-x-8 pointer-events-none"
        }`}
      >
        <Colorbar
          manifest={manifest}
          selectedVariable={selectedVariable}
          config={activeColorbarConfig}
          sliceRange={activeSliceRange}
          onChangeConfig={(newCfg) =>
            setCustomColorbar((prev) => ({ ...prev, [selectedVariable]: newCfg }))
          }
        />
      </div>

      {/* 4. Full-Screen 3D Cesium Globe */}
      <main className="w-full h-full">
        <GlobeWrapper
          selectedVariable={selectedVariable}
          depthIndex={depthIndex}
          timeIndex={timeIndex}
          manifest={manifest}
          viewMode={viewMode}
          verticalExaggeration={verticalExaggeration}
          showArgo={showArgo}
          showGliders={showGliders}
          onSelectFloat={handleSelectFloat}
          selectedFloatId={selectedFloat?.float_id}
          onSelectGlider={handleSelectGlider}
          selectedGliderId={selectedGlider?.glider_id}
          colorbarConfig={activeColorbarConfig}
          cameraTrigger={cameraTrigger}
          onSliceDataCalculated={handleSliceDataCalculated}
          rightPanelOpen={rightPanelOpen}
        />
      </main>

      {/* ── RIGHT EDGE SLIDE TAB ─────────────────────────────────────── */}
      <button
        onClick={() => setRightPanelOpen((o) => !o)}
        title={rightPanelOpen ? "Hide right panels" : "Show right panels"}
        aria-label="Toggle right panel"
        className="flex fixed z-50 top-1/2 -translate-y-1/2 right-0
          flex-col items-center justify-center gap-1
          w-5 h-20 rounded-l-xl
          ocean-glass border border-r-0 border-cyan-500/30
          text-cyan-400 hover:text-white hover:bg-cyan-950/80
          shadow-lg shadow-cyan-950/40 cursor-pointer transition-colors duration-200"
      >
        <svg
          className={`w-3 h-3 transition-transform duration-300 ${rightPanelOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span
          className="text-[9px] font-bold tracking-widest uppercase opacity-70"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          {rightPanelOpen ? "Hide" : "Panels"}
        </span>
      </button>

      {/* 5. Argo Float Depth-Resolved CTD Profile Drawer */}
      <ArgoProfileDrawer
        selectedFloat={selectedFloat}
        onClose={() => setSelectedFloat(null)}
      />

      {/* 6. Ocean Glider Trajectory and CTD Profile Drawer */}
      <GliderProfileDrawer
        selectedGlider={selectedGlider}
        onClose={() => setSelectedGlider(null)}
      />

      {/* 7. Bottom Status and Inspection InfoBar (Subscribed directly to hoverStore) */}
      <InfoBar />
    </div>
  );
}
