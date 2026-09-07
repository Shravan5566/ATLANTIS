"use client";

import React, { useState } from "react";
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

  // Active colorbar settings (custom override or manifest defaults)
  const activeColorbarConfig: ColorbarConfig = customColorbar[selectedVariable] || {
    palette: currentVariableMeta?.palette || "thermal",
    scaleType: "linear",
    min: currentVariableMeta?.min ?? 0,
    max: currentVariableMeta?.max ?? 30,
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
        isLoading={isManifestLoading}
      />

      {/* 3. Top-Right Interactive Colorbar Legend & Editor */}
      <Colorbar
        manifest={manifest}
        selectedVariable={selectedVariable}
        config={activeColorbarConfig}
        onChangeConfig={(newCfg) =>
          setCustomColorbar((prev) => ({ ...prev, [selectedVariable]: newCfg }))
        }
      />

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
        />
      </main>

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
