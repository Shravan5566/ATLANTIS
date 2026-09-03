"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getManifest, ManifestResponse } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import Colorbar from "@/components/Colorbar";
import InfoBar, { HoverInfo } from "@/components/InfoBar";
import GlobeWrapper from "@/components/GlobeWrapper";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedVariable, setSelectedVariable] = useState("thetao");
  const [depthIndex, setDepthIndex] = useState(0);
  const [timeIndex, setTimeIndex] = useState(0);
  const [showArgo, setShowArgo] = useState(true);
  const [showGliders, setShowGliders] = useState(true);

  // Volumetric water column states
  const [viewMode, setViewMode] = useState<"single" | "volumetric">("single");
  const [verticalExaggeration, setVerticalExaggeration] = useState(150);

  const [cameraTrigger, setCameraTrigger] = useState<{
    lat: number;
    lon: number;
    height: number;
    pitch?: number;
    heading?: number;
    key: number;
  } | null>(null);

  const [hoverInfo, setHoverInfo] = useState<HoverInfo>({
    latitude: null,
    longitude: null,
    depth: 0.5,
    value: null,
    variableName: "Sea Water Temperature",
    variableUnits: "°C",
  });

  // Fetch Manifest via React Query
  const { data: manifest, isLoading: isManifestLoading } = useQuery<ManifestResponse>({
    queryKey: ["manifest"],
    queryFn: getManifest,
  });

  const handleFlyToRegion = (
    lat: number,
    lon: number,
    height: number,
    pitch: number = -85,
    heading: number = 0
  ) => {
    setCameraTrigger({ lat, lon, height, pitch, heading, key: Date.now() });
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

      {/* 3. Top-Right Dynamic Colorbar Legend */}
      <Colorbar
        manifest={manifest}
        selectedVariable={selectedVariable}
      />

      {/* 4. Full-Screen 3D Cesium Globe */}
      <main className="w-full h-full">
        <GlobeWrapper
          onHoverChange={setHoverInfo}
          selectedVariable={selectedVariable}
          depthIndex={depthIndex}
          timeIndex={timeIndex}
          manifest={manifest}
          viewMode={viewMode}
          verticalExaggeration={verticalExaggeration}
          cameraTrigger={cameraTrigger}
        />
      </main>

      {/* 5. Bottom Status and Inspection InfoBar */}
      <InfoBar info={hoverInfo} />
    </div>
  );
}
