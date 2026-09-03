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
  const [cameraTrigger, setCameraTrigger] = useState<{
    lat: number;
    lon: number;
    height: number;
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

  const depthLevels = manifest?.depth_levels || [0.5, 5, 10, 20, 50, 100, 200, 500, 1000];
  const currentDepth = depthLevels[depthIndex] ?? 0.5;
  const currentVariableMeta = manifest?.variables[selectedVariable];

  const handleFlyToRegion = (lat: number, lon: number, height: number) => {
    setCameraTrigger({ lat, lon, height, key: Date.now() });
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
          variableMeta={
            currentVariableMeta
              ? { display_name: currentVariableMeta.display_name, units: currentVariableMeta.units }
              : undefined
          }
          currentDepth={currentDepth}
          cameraTrigger={cameraTrigger}
        />
      </main>

      {/* 5. Bottom Status and Inspection InfoBar */}
      <InfoBar info={hoverInfo} />
    </div>
  );
}
