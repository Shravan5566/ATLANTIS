"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as Cesium from "cesium";
import {
  Viewer as ResiumViewer,
  Entity,
  ScreenSpaceEventHandler,
  ScreenSpaceEvent,
} from "resium";
import { useQuery } from "@tanstack/react-query";
import {
  getField,
  getArgoPositions,
  getGliderTracks,
  FieldTileResponse,
  ManifestResponse,
  ArgoPositionItem,
  GliderTrackItem,
} from "@/lib/api";
import { gridToCanvas } from "@/lib/colors";
import { hoverStore, HoverInfo } from "@/lib/hoverStore";
import { ColorbarConfig } from "./Colorbar";
import { Loader2, Layers } from "lucide-react";

// Configure Cesium static base URL in browser
if (typeof window !== "undefined") {
  (window as any).CESIUM_BASE_URL = "/cesium";
  const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
  if (ionToken && ionToken.trim() !== "") {
    Cesium.Ion.defaultAccessToken = ionToken.trim();
  }
}

interface GlobeProps {
  onHoverChange?: (info: HoverInfo) => void;
  selectedVariable: string;
  depthIndex: number;
  timeIndex: number;
  manifest?: ManifestResponse;
  viewMode: "single" | "volumetric";
  verticalExaggeration: number;
  showArgo: boolean;
  showGliders: boolean;
  onSelectFloat: (float: ArgoPositionItem) => void;
  selectedFloatId?: string;
  onSelectGlider?: (glider: GliderTrackItem) => void;
  selectedGliderId?: string;
  colorbarConfig?: ColorbarConfig;
  cameraTrigger?: { lat: number; lon: number; height: number; pitch?: number; heading?: number; key: number } | null;
}

// Bounding box for Copernicus numerical model tile overlay (68°–90°E, 6°–25°N)
const MODEL_GRID_RECTANGLE = Cesium.Rectangle.fromDegrees(68.0, 6.0, 90.0, 25.0);

// Canonical depth levels for 3D volumetric water column stack
const VOLUMETRIC_DEPTH_INDICES = [0, 5, 9, 13]; // 0.5m, 50m, 200m, 1000m
const VOLUMETRIC_DEPTH_METERS = [0.5, 50.0, 200.0, 1000.0];
const VOLUMETRIC_LABELS = [
  "Layer 1: Sea Surface (0.5m)",
  "Layer 2: Mixed Base (50m)",
  "Layer 3: Thermocline (200m)",
  "Layer 4: Deep Abyssal (1000m)",
];

// India's Official EEZ Sector Annotations
const EEZ_SECTORS = [
  {
    name: "Arabian Sea & Lakshadweep EEZ Sector",
    label: "Arabian Sea & Lakshadweep EEZ\n(Area: ~860,000 km² · 200 NM)",
    lat: 13.5,
    lon: 69.8,
  },
  {
    name: "Bay of Bengal EEZ Sector",
    label: "Bay of Bengal EEZ\n(Area: ~800,000 km² · 200 NM)",
    lat: 15.0,
    lon: 86.8,
  },
  {
    name: "Andaman & Nicobar Islands EEZ Sector",
    label: "Andaman & Nicobar Islands EEZ\n(Area: ~664,448 km² · 200 NM)",
    lat: 10.5,
    lon: 93.5,
  },
];

export default function Globe({
  onHoverChange,
  selectedVariable,
  depthIndex,
  timeIndex,
  manifest,
  viewMode,
  verticalExaggeration,
  showArgo,
  showGliders,
  onSelectFloat,
  selectedFloatId,
  onSelectGlider,
  selectedGliderId,
  colorbarConfig,
  cameraTrigger,
}: GlobeProps) {
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Active imagery layers tracking for 2D single mode
  const activeLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const fadeAnimationRef = useRef<number | null>(null);

  // Volumetric entities tracking in Cesium scene
  const volumetricEntitiesRef = useRef<Cesium.Entity[]>([]);

  // Memoized in-memory texture cache to prevent CPU base64 encoding bottlenecks
  const textureCacheRef = useRef<Map<string, string>>(new Map());

  // Throttling timestamp for mouse move
  const lastMouseMoveTimeRef = useRef<number>(0);

  // Track GeoJSON Data Sources
  const eezDataSourceRef = useRef<Cesium.GeoJsonDataSource | null>(null);
  const territorialDataSourceRef = useRef<Cesium.GeoJsonDataSource | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Query active single field slice
  const {
    data: tileData,
    isLoading: isFieldLoading,
    isFetching: isFieldFetching,
  } = useQuery<FieldTileResponse>({
    queryKey: ["field", selectedVariable, timeIndex, depthIndex],
    queryFn: () => getField(selectedVariable, timeIndex, depthIndex),
    staleTime: 1000 * 60 * 5,
    enabled: viewMode === "single",
  });

  // 2. Query volumetric depth slices
  const [volumetricSlices, setVolumetricSlices] = useState<FieldTileResponse[]>([]);
  const [isVolumetricLoading, setIsVolumetricLoading] = useState(false);

  useEffect(() => {
    if (viewMode !== "volumetric") return;

    let isCancelled = false;
    setIsVolumetricLoading(true);

    Promise.all(
      VOLUMETRIC_DEPTH_INDICES.map((dIdx) =>
        getField(selectedVariable, timeIndex, dIdx).catch(() => null)
      )
    ).then((results) => {
      if (!isCancelled) {
        setVolumetricSlices(results.filter(Boolean) as FieldTileResponse[]);
        setIsVolumetricLoading(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [viewMode, selectedVariable, timeIndex]);

  // 3. Query Argo Float Positions
  const { data: argoPositions } = useQuery<ArgoPositionItem[]>({
    queryKey: ["argo-positions"],
    queryFn: getArgoPositions,
    staleTime: 1000 * 60 * 10,
  });

  // 4. Query Glider Tracks
  const { data: gliderTracks } = useQuery<GliderTrackItem[]>({
    queryKey: ["glider-tracks"],
    queryFn: getGliderTracks,
    staleTime: 1000 * 60 * 10,
  });

  const currentVariableMeta = manifest?.variables[selectedVariable];
  const depthLevels = manifest?.depth_levels || [0.5];
  const currentDepth = depthLevels[depthIndex] ?? 0.5;

  // Helper to retrieve or build cached Base64 data URL
  const getCachedTexture = useCallback(
    (
      values: (number | null)[][],
      minVal: number,
      maxVal: number,
      palette: string,
      scaleType: "linear" | "log",
      key: string,
      size: number = 512
    ): string => {
      const cached = textureCacheRef.current.get(key);
      if (cached) return cached;

      const canvas = gridToCanvas(values, minVal, maxVal, palette, scaleType, size, size);
      const dataUrl = canvas.toDataURL("image/png");
      textureCacheRef.current.set(key, dataUrl);

      // Keep cache bounded to 64 textures
      if (textureCacheRef.current.size > 64) {
        const firstKey = textureCacheRef.current.keys().next().value;
        if (firstKey) textureCacheRef.current.delete(firstKey);
      }

      return dataUrl;
    },
    []
  );

  // Initial camera and scene performance configuration
  const handleViewerReady = useCallback((viewer: Cesium.Viewer) => {
    if (!viewer) return;
    viewerRef.current = viewer;

    // Camera initial position centered over India's maritime expanse
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(79.0, 15.0, 2700000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-88),
        roll: 0.0,
      },
      duration: 1.5,
    });

    // 60 FPS Performance Tuning
    viewer.targetFrameRate = 60;
    viewer.resolutionScale = 1.0;
    viewer.scene.globe.maximumScreenSpaceError = 2.0;
    viewer.scene.globe.tileCacheSize = 120;
    viewer.scene.globe.enableLighting = false; // Disable heavy dynamic shadow/lighting computations
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0002;
    viewer.scene.globe.showGroundAtmosphere = true;


    // Translucency only enabled dynamically when in 3D volumetric mode
    viewer.scene.globe.translucency.enabled = false;
    viewer.scene.globe.translucency.frontFaceAlpha = 0.55;
    viewer.scene.globe.translucency.backFaceAlpha = 0.35;

    // Load Authentic India EEZ GeoJSON (Flanders Marine Institute / VLIZ v12)
    fetch("/india_eez.geojson")
      .then((res) => res.json())
      .then((data) => {
        // 1. Add authentic EEZ geometry outline (no murky fill)
        Cesium.GeoJsonDataSource.load(data, {
          stroke: Cesium.Color.TRANSPARENT,
          fill: Cesium.Color.TRANSPARENT,
          clampToGround: true,
        }).then((ds) => {
          eezDataSourceRef.current = ds;
          viewer.dataSources.add(ds);
        });

        // 2. Add glowing outer boundary polylines for each 200 NM sector ring
        data.features.forEach((feat: any, fIdx: number) => {
          const geom = feat.geometry;
          const processRings = (rings: number[][][]) => {
            rings.forEach((ring, rIdx) => {
              const positions = ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 10));
              viewer.entities.add({
                name: `India EEZ 200 NM Limit Ring ${fIdx + 1}-${rIdx + 1}`,
                polyline: {
                  positions,
                  width: 3.5,
                  clampToGround: true,
                  material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.28,
                    color: Cesium.Color.fromCssColorString("#00f2a9"),
                  }),
                },
              });
            });
          };

          if (geom.type === "Polygon") {
            processRings([geom.coordinates[0]]);
          } else if (geom.type === "MultiPolygon") {
            geom.coordinates.forEach((poly: any) => {
              processRings([poly[0]]);
            });
          }
        });
      })
      .catch((err) => {
        console.warn("Could not load /india_eez.geojson:", err);
      });

    // Load Authentic India 12 NM Territorial Sea Limit
    fetch("/india_12nm.geojson")
      .then((res) => res.json())
      .then((data) => {
        data.features.forEach((feat: any, fIdx: number) => {
          const geom = feat.geometry;
          const process12NMRings = (rings: number[][][]) => {
            rings.forEach((ring, rIdx) => {
              const positions = ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 15));
              viewer.entities.add({
                name: `India 12 NM Territorial Sea Limit ${fIdx + 1}-${rIdx + 1}`,
                polyline: {
                  positions,
                  width: 2.0,
                  clampToGround: true,
                  material: new Cesium.PolylineDashMaterialProperty({
                    color: Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.8),
                    dashLength: 16.0,
                  }),
                },
              });
            });
          };

          if (geom.type === "Polygon") {
            process12NMRings([geom.coordinates[0]]);
          } else if (geom.type === "MultiPolygon") {
            geom.coordinates.forEach((poly: any) => {
              process12NMRings([poly[0]]);
            });
          }
        });
      })
      .catch((err) => {
        console.warn("Could not load /india_12nm.geojson:", err);
      });
  }, []);

  // Dynamically toggle globe translucency for volumetric mode
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.scene.globe.translucency.enabled = viewMode === "volumetric";
  }, [viewMode]);

  // Handle external camera triggers
  useEffect(() => {
    if (cameraTrigger && viewerRef.current) {
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          cameraTrigger.lon,
          cameraTrigger.lat,
          cameraTrigger.height
        ),
        orientation: {
          heading: Cesium.Math.toRadians(cameraTrigger.heading ?? 0),
          pitch: Cesium.Math.toRadians(cameraTrigger.pitch ?? -85),
          roll: 0.0,
        },
        duration: 1.5,
      });
    }
  }, [cameraTrigger]);

  // Clean up volumetric entities
  const clearVolumetricEntities = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    volumetricEntitiesRef.current.forEach((ent) => {
      viewer.entities.remove(ent);
    });
    volumetricEntitiesRef.current = [];
  }, []);

  // Update 2D Single Layer with memoized texture cache
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (viewMode === "volumetric") {
      if (activeLayerRef.current && viewer.imageryLayers.contains(activeLayerRef.current)) {
        activeLayerRef.current.show = false;
      }
      return;
    }

    if (activeLayerRef.current && viewer.imageryLayers.contains(activeLayerRef.current)) {
      activeLayerRef.current.show = true;
    }

    clearVolumetricEntities();

    if (!tileData || !tileData.values) return;

    // Calculate actual active slice range for high-contrast, uniform scientific gradient
    let sliceMin = Infinity;
    let sliceMax = -Infinity;
    for (let r = 0; r < tileData.values.length; r++) {
      const row = tileData.values[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (v !== null && !isNaN(v)) {
          if (v < sliceMin) sliceMin = v;
          if (v > sliceMax) sliceMax = v;
        }
      }
    }
    const hasSliceRange = sliceMin !== Infinity && sliceMax !== -Infinity && sliceMax > sliceMin;
    const minVal = colorbarConfig?.min ?? (hasSliceRange ? sliceMin : currentVariableMeta?.min ?? 0);
    const maxVal = colorbarConfig?.max ?? (hasSliceRange ? sliceMax : currentVariableMeta?.max ?? 30);
    const palette = colorbarConfig?.palette ?? currentVariableMeta?.palette ?? "thermal";
    const scaleType = colorbarConfig?.scaleType ?? "linear";

    const cacheKey = `${selectedVariable}_${timeIndex}_${depthIndex}_${minVal}_${maxVal}_${palette}_${scaleType}`;
    const dataUrl = getCachedTexture(
      tileData.values,
      minVal,
      maxVal,
      palette,
      scaleType,
      cacheKey,
      512
    );

    try {
      const provider = new Cesium.SingleTileImageryProvider({
        url: dataUrl,
        rectangle: MODEL_GRID_RECTANGLE,
        tileWidth: 512,
        tileHeight: 512,
      });

      const newLayer = viewer.imageryLayers.addImageryProvider(provider);
      newLayer.alpha = 0.0;

      const oldLayer = activeLayerRef.current;
      const startTime = performance.now();
      const fadeDuration = 250;

      if (fadeAnimationRef.current) {
        cancelAnimationFrame(fadeAnimationRef.current);
      }

      const animateCrossFade = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / fadeDuration);
        const t = 0.5 - 0.5 * Math.cos(progress * Math.PI);
        newLayer.alpha = t * 0.62;

        if (oldLayer && viewer.imageryLayers.contains(oldLayer)) {
          oldLayer.alpha = (1.0 - t) * 0.62;
        }

        if (progress < 1.0) {
          fadeAnimationRef.current = requestAnimationFrame(animateCrossFade);
        } else {
          if (oldLayer && viewer.imageryLayers.contains(oldLayer)) {
            viewer.imageryLayers.remove(oldLayer, true);
          }
          activeLayerRef.current = newLayer;
        }
      };

      fadeAnimationRef.current = requestAnimationFrame(animateCrossFade);
    } catch (err) {
      console.warn("Imagery provider error:", err);
    }

    return () => {
      if (fadeAnimationRef.current) {
        cancelAnimationFrame(fadeAnimationRef.current);
      }
    };
  }, [
    tileData,
    currentVariableMeta,
    viewMode,
    clearVolumetricEntities,
    colorbarConfig,
    getCachedTexture,
    selectedVariable,
    timeIndex,
    depthIndex,
  ]);

  // Update 3D Volumetric Depth Slices Stack with memoized textures
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewMode !== "volumetric" || volumetricSlices.length === 0) return;

    clearVolumetricEntities();

    const minVal = colorbarConfig?.min ?? currentVariableMeta?.min ?? 0;
    const maxVal = colorbarConfig?.max ?? currentVariableMeta?.max ?? 30;
    const palette = colorbarConfig?.palette ?? currentVariableMeta?.palette ?? "thermal";
    const scaleType = colorbarConfig?.scaleType ?? "linear";

    const createdEntities: Cesium.Entity[] = [];

    volumetricSlices.forEach((slice, idx) => {
      if (!slice.values) return;
      const depthMeter = VOLUMETRIC_DEPTH_METERS[idx] ?? 0;
      const labelText = VOLUMETRIC_LABELS[idx] ?? `${depthMeter}m`;
      const altitude = -(depthMeter * verticalExaggeration);

      const cacheKey = `vol_${selectedVariable}_${timeIndex}_${idx}_${minVal}_${maxVal}_${palette}_${scaleType}`;
      const dataUrl = getCachedTexture(
        slice.values,
        minVal,
        maxVal,
        palette,
        scaleType,
        cacheKey,
        384
      );

      const sliceEntity = viewer.entities.add({
        name: `Volumetric Slice ${labelText}`,
        rectangle: {
          coordinates: MODEL_GRID_RECTANGLE,
          height: altitude,
          material: new Cesium.ImageMaterialProperty({
            image: dataUrl,
            transparent: true,
            color: Cesium.Color.WHITE.withAlpha(0.68),
          }),
          outline: true,
          outlineColor: Cesium.Color.CYAN.withAlpha(0.45),
          outlineWidth: 2,
        },
      });
      createdEntities.push(sliceEntity);

      const labelEntity = viewer.entities.add({
        name: `Label ${labelText}`,
        position: Cesium.Cartesian3.fromDegrees(90.2, 7.0, altitude),
        label: {
          text: labelText,
          font: "12px monospace",
          fillColor: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(10, 0),
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          scaleByDistance: new Cesium.NearFarScalar(500000, 1.0, 6000000, 0.4),
        },
      });
      createdEntities.push(labelEntity);
    });

    volumetricEntitiesRef.current = createdEntities;

    return () => {
      clearVolumetricEntities();
    };
  }, [
    viewMode,
    volumetricSlices,
    currentVariableMeta,
    verticalExaggeration,
    clearVolumetricEntities,
    colorbarConfig,
    getCachedTexture,
    selectedVariable,
    timeIndex,
  ]);

  // Handle Left Click: Pick Argo float markers and Glider trajectories
  const handleLeftClick = useCallback(
    (event: any) => {
      const viewer = viewerRef.current;
      const clickPos = event?.position;
      if (!viewer || !clickPos) return;

      const pickedObject = viewer.scene.pick(clickPos);
      if (Cesium.defined(pickedObject) && pickedObject.id) {
        const entity = pickedObject.id;

        // 1. Check if entity is an Argo Float marker
        if (entity.name && entity.name.startsWith("Argo Float #") && argoPositions) {
          const floatId = entity.name.replace("Argo Float #", "").trim();
          const found = argoPositions.find((f) => String(f.float_id) === String(floatId));
          if (found) {
            onSelectFloat(found);
            return;
          }
        }

        // 2. Check if entity is a Glider Track or Glider Head marker
        if (entity.name && entity.name.startsWith("Glider Track ") && gliderTracks && onSelectGlider) {
          const gliderId = entity.name.replace("Glider Track ", "").trim();
          const found = gliderTracks.find((g) => String(g.glider_id) === String(gliderId));
          if (found) {
            onSelectGlider(found);
            return;
          }
        }
      }
    },
    [argoPositions, gliderTracks, onSelectFloat, onSelectGlider]
  );

  // Ultra-Smooth 60 FPS Throttled Mouse Hover Handler
  const handleMouseMove = useCallback(
    (movement: any) => {
      const viewer = viewerRef.current;
      const endPos = movement?.endPosition || movement?.position;
      if (!viewer || !endPos) return;

      // Throttle to max 22Hz (45ms gate) to keep render thread 100% fluid at 60 FPS
      const now = performance.now();
      if (now - lastMouseMoveTimeRef.current < 45) return;
      lastMouseMoveTimeRef.current = now;

      // Check if cursor hovers over an in-situ probe (Argo Float or Glider)
      let inSituTargetType: string | undefined = undefined;
      let inSituTargetId: string | undefined = undefined;
      try {
        const picked = viewer.scene.pick(endPos);
        if (Cesium.defined(picked) && picked.id?.name) {
          const eName = picked.id.name;
          if (eName.startsWith("Argo Float #")) {
            inSituTargetType = "Argo Float";
            inSituTargetId = eName.replace("Argo Float #", "").trim();
          } else if (eName.startsWith("Glider Track ")) {
            inSituTargetType = "Ocean Glider";
            inSituTargetId = eName.replace("Glider Track ", "").trim();
          }
        }
      } catch (err) {
        // Pass through smoothly
      }

      // Pure CPU Ellipsoid ray cast — instant and zero GPU stall
      const cartesian = viewer.camera.pickEllipsoid(
        endPos,
        viewer.scene.globe.ellipsoid
      );

      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);

        const inEEZ = lon >= 68.0 && lon <= 90.0 && lat >= 6.0 && lat <= 25.0;
        let realValue: number | null = null;

        const activeValuesMatrix =
          viewMode === "volumetric" ? volumetricSlices[0]?.values : tileData?.values;
        const activeLatGrid =
          viewMode === "volumetric" ? volumetricSlices[0]?.lat_grid : tileData?.lat_grid;
        const activeLonGrid =
          viewMode === "volumetric" ? volumetricSlices[0]?.lon_grid : tileData?.lon_grid;

        if (inEEZ && activeValuesMatrix && activeLatGrid && activeLonGrid) {
          const latIdx = Math.max(
            0,
            Math.min(
              activeLatGrid.length - 1,
              Math.round(
                ((lat - activeLatGrid[0]) /
                  (activeLatGrid[activeLatGrid.length - 1] - activeLatGrid[0])) *
                  (activeLatGrid.length - 1)
              )
            )
          );
          const lonIdx = Math.max(
            0,
            Math.min(
              activeLonGrid.length - 1,
              Math.round(
                ((lon - activeLonGrid[0]) /
                  (activeLonGrid[activeLonGrid.length - 1] - activeLonGrid[0])) *
                  (activeLonGrid.length - 1)
              )
            )
          );

          const cellVal = activeValuesMatrix[latIdx]?.[lonIdx];
          if (cellVal !== undefined && cellVal !== null && !isNaN(cellVal)) {
            realValue = cellVal;
          }
        }

        const info: HoverInfo = {
          latitude: lat,
          longitude: lon,
          depth: inEEZ ? (viewMode === "volumetric" ? 0.5 : currentDepth) : null,
          value: realValue,
          variableName: currentVariableMeta?.display_name || selectedVariable,
          variableUnits: currentVariableMeta?.units || "",
          targetType: inSituTargetType || (viewMode === "volumetric" ? "3D Column Stack" : undefined),
          targetId: inSituTargetId,
        };

        // Write directly to decoupled hoverStore — InfoBar updates without parent re-renders!
        hoverStore.set(info);
        if (onHoverChange) {
          onHoverChange(info);
        }
      }
    },
    [
      currentDepth,
      currentVariableMeta,
      onHoverChange,
      selectedVariable,
      tileData,
      viewMode,
      volumetricSlices,
    ]
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

  const isUpdating = isFieldLoading || isFieldFetching || isVolumetricLoading;

  return (
    <div className="relative w-full h-full">
      {/* Loading Spinner Badge */}
      {isUpdating && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full ocean-glass border border-cyan-400/50 text-cyan-300 text-xs font-medium shadow-lg shadow-cyan-950/60 animate-in fade-in duration-200">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span>
            {viewMode === "volumetric"
              ? "Synthesizing 3D Volumetric Water Column..."
              : `Loading ${currentVariableMeta?.display_name || selectedVariable} (${currentDepth}m)...`}
          </span>
        </div>
      )}

      {/* Volumetric Active Badge */}
      {viewMode === "volumetric" && (
        <div className="absolute top-20 left-8 z-30 hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg ocean-glass border border-emerald-400/40 text-emerald-300 text-xs font-semibold shadow-md">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>3D Water Column Mode Active ({verticalExaggeration}x Exaggeration)</span>
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
          <ScreenSpaceEvent
            action={handleLeftClick}
            type={Cesium.ScreenSpaceEventType.LEFT_CLICK}
          />
        </ScreenSpaceEventHandler>

        {/* Argo Float In-Situ Markers */}
        {showArgo &&
          argoPositions?.map((fl) => {
            const isSelected = selectedFloatId === fl.float_id;
            return (
              <Entity
                key={`argo-${fl.float_id}`}
                name={`Argo Float #${fl.float_id}`}
                position={Cesium.Cartesian3.fromDegrees(fl.longitude, fl.latitude, 50)}
                point={{
                  pixelSize: isSelected ? 14 : 9,
                  color: isSelected
                    ? Cesium.Color.fromCssColorString("#ff007f")
                    : Cesium.Color.fromCssColorString("#00d2ff"),
                  outlineColor: isSelected
                    ? Cesium.Color.WHITE
                    : Cesium.Color.fromCssColorString("#07192e"),
                  outlineWidth: isSelected ? 3 : 1.5,
                  scaleByDistance: new Cesium.NearFarScalar(500000, 1.2, 5000000, 0.7),
                }}
                label={{
                  text: isSelected ? `Float #${fl.float_id}` : "",
                  font: "11px monospace",
                  fillColor: Cesium.Color.WHITE,
                  outlineColor: Cesium.Color.BLACK,
                  outlineWidth: 2,
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  pixelOffset: new Cesium.Cartesian2(0, -16),
                  horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                  showBackground: true,
                  backgroundColor: Cesium.Color.fromCssColorString("#07192e").withAlpha(0.8),
                }}
              />
            );
          })}

        {/* Ocean Glider Trajectory Polylines */}
        {showGliders &&
          gliderTracks?.map((glider) => {
            const positions = glider.points.map((p) =>
              Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 100)
            );
            const latestPoint = glider.points[glider.points.length - 1];
            const isGliderSelected = selectedGliderId === glider.glider_id;

            return (
              <React.Fragment key={`glider-group-${glider.glider_id}`}>
                {/* 1. Track Polyline */}
                <Entity
                  name={`Glider Track ${glider.glider_id}`}
                  polyline={{
                    positions: positions,
                    width: isGliderSelected ? 6.0 : 3.5,
                    material: new Cesium.PolylineGlowMaterialProperty({
                      glowPower: isGliderSelected ? 0.45 : 0.2,
                      color: isGliderSelected
                        ? Cesium.Color.fromCssColorString("#fbbf24")
                        : Cesium.Color.fromCssColorString("#f59e0b"),
                    }),
                  }}
                />

                {/* 2. Glider Head Position Marker */}
                {latestPoint && (
                  <Entity
                    name={`Glider Track ${glider.glider_id}`}
                    position={Cesium.Cartesian3.fromDegrees(
                      latestPoint.lon,
                      latestPoint.lat,
                      150
                    )}
                    point={{
                      pixelSize: isGliderSelected ? 16 : 11,
                      color: isGliderSelected
                        ? Cesium.Color.fromCssColorString("#f59e0b")
                        : Cesium.Color.fromCssColorString("#d97706"),
                      outlineColor: Cesium.Color.WHITE,
                      outlineWidth: isGliderSelected ? 3 : 2,
                    }}
                    label={
                      isGliderSelected
                        ? {
                            text: `Glider: ${glider.glider_id}`,
                            font: "11px monospace",
                            fillColor: Cesium.Color.fromCssColorString("#fef08a"),
                            outlineColor: Cesium.Color.BLACK,
                            outlineWidth: 2,
                            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                            pixelOffset: new Cesium.Cartesian2(0, -20),
                            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                            showBackground: true,
                            backgroundColor: Cesium.Color.fromCssColorString("#451a03").withAlpha(0.85),
                          }
                        : undefined
                    }
                  />
                )}
              </React.Fragment>
            );
          })}
      </ResiumViewer>
    </div>
  );
}
