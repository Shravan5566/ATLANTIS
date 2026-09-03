"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as Cesium from "cesium";
import {
  Viewer as ResiumViewer,
  Entity,
  RectangleGraphics,
  ScreenSpaceEventHandler,
  ScreenSpaceEvent,
} from "resium";
import { HoverInfo } from "./InfoBar";

// Configure Cesium static base URL in browser
if (typeof window !== "undefined") {
  (window as any).CESIUM_BASE_URL = "/cesium";
  const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
  if (ionToken && ionToken.trim() !== "") {
    Cesium.Ion.defaultAccessToken = ionToken.trim();
  }
}

interface GlobeProps {
  onHoverChange: (info: HoverInfo) => void;
  selectedVariable: string;
  variableMeta?: {
    display_name: string;
    units: string;
  };
  currentDepth: number;
  cameraTrigger?: { lat: number; lon: number; height: number; key: number } | null;
}

// India's EEZ bounding coordinates
const EEZ_RECTANGLE = Cesium.Rectangle.fromDegrees(68.0, 6.0, 90.0, 25.0);

export default function Globe({
  onHoverChange,
  selectedVariable,
  variableMeta,
  currentDepth,
  cameraTrigger,
}: GlobeProps) {
  const viewerRef = useRef<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initial camera fly-to India EEZ bounding box
  const handleViewerReady = useCallback((viewer: Cesium.Viewer) => {
    if (!viewer) return;
    viewerRef.current = viewer;

    // Center camera looking over the Indian Peninsula, Arabian Sea & Bay of Bengal
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(79.0, 15.5, 2600000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-88), // Looking almost directly down
        roll: 0.0,
      },
      duration: 2.0,
    });

    // Scene visual tuning
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = false;
  }, []);

  // Handle external camera triggers from Region presets
  useEffect(() => {
    if (cameraTrigger && viewerRef.current) {
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          cameraTrigger.lon,
          cameraTrigger.lat,
          cameraTrigger.height
        ),
        duration: 1.5,
      });
    }
  }, [cameraTrigger]);

  // Handle cursor hover over the globe
  const handleMouseMove = useCallback(
    (movement: any) => {
      const viewer = viewerRef.current;
      const endPos = movement?.endPosition || movement?.position;
      if (!viewer || !endPos) return;

      const cartesian = viewer.camera.pickEllipsoid(
        endPos,
        viewer.scene.globe.ellipsoid
      );

      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);

        // Check if cursor is within India's EEZ
        const inEEZ = lon >= 68.0 && lon <= 90.0 && lat >= 6.0 && lat <= 25.0;

        // Approximate placeholder value for initial state
        const placeholderValue = inEEZ
          ? 28.5 - (currentDepth / 50.0) * 1.5 + (lon - 68.0) * 0.05
          : null;

        onHoverChange({
          latitude: lat,
          longitude: lon,
          depth: inEEZ ? currentDepth : null,
          value: placeholderValue !== null ? Math.max(4.0, placeholderValue) : null,
          variableName: variableMeta?.display_name || selectedVariable,
          variableUnits: variableMeta?.units || "",
        });
      }
    },
    [currentDepth, onHoverChange, selectedVariable, variableMeta]
  );

  if (!isMounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-cyan-400 font-mono text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span>Initializing ATLANTIS 3D Cesium Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <ResiumViewer
        full
        ref={(e) => {
          if (e?.cesiumElement) {
            handleViewerReady(e.cesiumElement);
          }
        }}
        animation={false}
        timeline={false}
        baseLayerPicker={false}
        geocoder={false}
        homeButton={false}
        infoBox={false}
        navigationHelpButton={false}
        sceneModePicker={false}
        selectionIndicator={false}
      >
        <ScreenSpaceEventHandler>
          <ScreenSpaceEvent
            action={handleMouseMove}
            type={Cesium.ScreenSpaceEventType.MOUSE_MOVE}
          />
        </ScreenSpaceEventHandler>

        {/* Placeholder Ocean Field Rectangle over India's EEZ */}
        <Entity
          name="India EEZ Ocean Parameter Field"
          description="Interactive ocean model boundary for India's Exclusive Economic Zone"
        >
          <RectangleGraphics
            coordinates={EEZ_RECTANGLE}
            material={Cesium.Color.fromCssColorString("#00d2ff").withAlpha(0.22)}
            outline={true}
            outlineColor={Cesium.Color.fromCssColorString("#00f2a9")}
            outlineWidth={2}
          />
        </Entity>
      </ResiumViewer>
    </div>
  );
}
