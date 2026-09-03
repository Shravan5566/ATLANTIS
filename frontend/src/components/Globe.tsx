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
import { useQuery } from "@tanstack/react-query";
import { getField, FieldTileResponse, ManifestResponse } from "@/lib/api";
import { gridToCanvas } from "@/lib/colors";
import { HoverInfo } from "./InfoBar";
import { Loader2 } from "lucide-react";

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
  depthIndex: number;
  timeIndex: number;
  manifest?: ManifestResponse;
  cameraTrigger?: { lat: number; lon: number; height: number; key: number } | null;
}

// India's EEZ bounding box coordinates (68°–90°E, 6°–25°N)
const EEZ_RECTANGLE = Cesium.Rectangle.fromDegrees(68.0, 6.0, 90.0, 25.0);

export default function Globe({
  onHoverChange,
  selectedVariable,
  depthIndex,
  timeIndex,
  manifest,
  cameraTrigger,
}: GlobeProps) {
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Active imagery layers tracking for smooth cross-fading
  const activeLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const fadeAnimationRef = useRef<number | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch 2D/3D field tile from backend for selected (variable, time, depth)
  const {
    data: tileData,
    isLoading: isFieldLoading,
    isFetching: isFieldFetching,
  } = useQuery<FieldTileResponse>({
    queryKey: ["field", selectedVariable, timeIndex, depthIndex],
    queryFn: () => getField(selectedVariable, timeIndex, depthIndex),
    staleTime: 1000 * 60 * 5,
  });

  const currentVariableMeta = manifest?.variables[selectedVariable];
  const depthLevels = manifest?.depth_levels || [0.5];
  const currentDepth = depthLevels[depthIndex] ?? 0.5;

  // Initial camera setup
  const handleViewerReady = useCallback((viewer: Cesium.Viewer) => {
    if (!viewer) return;
    viewerRef.current = viewer;

    // Center camera looking directly down over India EEZ
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(79.0, 15.5, 2600000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-88),
        roll: 0.0,
      },
      duration: 2.0,
    });

    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = false;
  }, []);

  // Handle external camera triggers
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

  // Cross-fade texture rendering when new field tile arrives
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !tileData || !tileData.values) return;

    const minVal = currentVariableMeta?.min ?? 0;
    const maxVal = currentVariableMeta?.max ?? 30;
    const palette = currentVariableMeta?.palette || "thermal";

    // 1. Generate colored canvas (NaN/null rendered as transparent)
    const canvas = gridToCanvas(tileData.values, minVal, maxVal, palette, 512, 512);

    try {
      // 2. Create Cesium SingleTileImageryProvider
      const provider = new Cesium.SingleTileImageryProvider({
        url: canvas.toDataURL("image/png"),
        rectangle: EEZ_RECTANGLE,
      });

      const newLayer = viewer.imageryLayers.addImageryProvider(provider);
      newLayer.alpha = 0.0;

      // 3. Smooth cross-fade animation
      const oldLayer = activeLayerRef.current;
      const startTime = performance.now();
      const fadeDuration = 350; // ms

      if (fadeAnimationRef.current) {
        cancelAnimationFrame(fadeAnimationRef.current);
      }

      const animateCrossFade = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / fadeDuration);

        // Ease in-out
        const t = 0.5 - 0.5 * Math.cos(progress * Math.PI);
        newLayer.alpha = t * 0.85;

        if (oldLayer && viewer.imageryLayers.contains(oldLayer)) {
          oldLayer.alpha = (1.0 - t) * 0.85;
        }

        if (progress < 1.0) {
          fadeAnimationRef.current = requestAnimationFrame(animateCrossFade);
        } else {
          // Animation finished: clean up old layer
          if (oldLayer && viewer.imageryLayers.contains(oldLayer)) {
            viewer.imageryLayers.remove(oldLayer, true);
          }
          activeLayerRef.current = newLayer;
        }
      };

      fadeAnimationRef.current = requestAnimationFrame(animateCrossFade);
    } catch (err) {
      console.warn("Cesium imagery provider update error:", err);
    }

    return () => {
      if (fadeAnimationRef.current) {
        cancelAnimationFrame(fadeAnimationRef.current);
      }
    };
  }, [tileData, currentVariableMeta]);

  // Handle cursor hover over the globe & lookup exact field value
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

        let realValue: number | null = null;

        // Lookup exact value from current field matrix
        if (inEEZ && tileData?.values && tileData?.lat_grid && tileData?.lon_grid) {
          const latGrid = tileData.lat_grid;
          const lonGrid = tileData.lon_grid;

          // Find nearest latitude index
          const latIdx = Math.max(
            0,
            Math.min(
              latGrid.length - 1,
              Math.round(((lat - latGrid[0]) / (latGrid[latGrid.length - 1] - latGrid[0])) * (latGrid.length - 1))
            )
          );

          // Find nearest longitude index
          const lonIdx = Math.max(
            0,
            Math.min(
              lonGrid.length - 1,
              Math.round(((lon - lonGrid[0]) / (lonGrid[lonGrid.length - 1] - lonGrid[0])) * (lonGrid.length - 1))
            )
          );

          const cellVal = tileData.values[latIdx]?.[lonIdx];
          if (cellVal !== undefined && cellVal !== null && !isNaN(cellVal)) {
            realValue = cellVal;
          }
        }

        onHoverChange({
          latitude: lat,
          longitude: lon,
          depth: inEEZ ? currentDepth : null,
          value: realValue,
          variableName: currentVariableMeta?.display_name || selectedVariable,
          variableUnits: currentVariableMeta?.units || "",
        });
      }
    },
    [currentDepth, currentVariableMeta, onHoverChange, selectedVariable, tileData]
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

  const isFieldUpdating = isFieldLoading || isFieldFetching;

  return (
    <div className="relative w-full h-full">
      {/* Loading Spinner Badge */}
      {isFieldUpdating && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full ocean-glass border border-cyan-400/50 text-cyan-300 text-xs font-medium shadow-lg shadow-cyan-950/60 animate-in fade-in duration-200">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span>
            Loading {currentVariableMeta?.display_name || selectedVariable} ({currentDepth}m)...
          </span>
        </div>
      )}

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

        {/* Outer EEZ Boundary Outline */}
        <Entity
          name="India EEZ Outer Perimeter"
          description="India Exclusive Economic Zone Boundary (68°–90°E, 6°–25°N)"
        >
          <RectangleGraphics
            coordinates={EEZ_RECTANGLE}
            material={Cesium.Color.TRANSPARENT}
            outline={true}
            outlineColor={Cesium.Color.fromCssColorString("#00f2a9").withAlpha(0.6)}
            outlineWidth={2}
          />
        </Entity>
      </ResiumViewer>
    </div>
  );
}
