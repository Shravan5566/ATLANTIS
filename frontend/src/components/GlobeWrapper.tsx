"use client";

import dynamic from "next/dynamic";
import React from "react";
import { HoverInfo } from "./InfoBar";

const GlobeInternal = dynamic(() => import("./Globe"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-950 text-cyan-400 font-mono text-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <span>Loading 3D Geospatial Engine...</span>
      </div>
    </div>
  ),
});

interface GlobeWrapperProps {
  onHoverChange: (info: HoverInfo) => void;
  selectedVariable: string;
  variableMeta?: {
    display_name: string;
    units: string;
  };
  currentDepth: number;
  cameraTrigger?: { lat: number; lon: number; height: number; key: number } | null;
}

export default function GlobeWrapper(props: GlobeWrapperProps) {
  return <GlobeInternal {...props} />;
}
