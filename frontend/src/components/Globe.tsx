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
import {
  Loader2,
  Layers,
  Box,
  Eye,
  Compass,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Sliders,
} from "lucide-react";

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
  onSliceDataCalculated?: (variable: string, depthIdx: number, min: number, max: number) => void;
  rightPanelOpen?: boolean;
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
  onSliceDataCalculated,
  rightPanelOpen = true,
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

  // Track current-vector arrow entities for cleanup
  const arrowEntitiesRef = useRef<Cesium.Entity[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 3D Navigation & Interaction States
  const [mouseMode, setMouseMode] = useState<"pan" | "tilt">("pan");
  const [sliceOpacity, setSliceOpacity] = useState<number>(0.66);
  const [visibleLayers, setVisibleLayers] = useState<{ [key: number]: boolean }>({
    0: true, // Layer 1: Surface (0.5m)
    1: true, // Layer 2: 50m
    2: true, // Layer 3: 200m
    3: true, // Layer 4: 1000m
  });
  const [isHudExpanded, setIsHudExpanded] = useState<boolean>(true);

  // Camera Navigation Helper Methods
  const flyToPreset = useCallback((type: "oblique" | "side" | "south" | "top") => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed?.()) return;
    switch (type) {
      case "oblique":
        // 3D Isometric / Oblique perspective over southern Indian Ocean looking NE towards India
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(74.0, 1.5, 2600000),
          orientation: {
            heading: Cesium.Math.toRadians(18),
            pitch: Cesium.Math.toRadians(-40),
            roll: 0,
          },
          duration: 1.4,
        });
        break;
      case "side":
        // Low angle side profile looking across the EEZ water column from West to East
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(57.0, 12.0, 2200000),
          orientation: {
            heading: Cesium.Math.toRadians(76),
            pitch: Cesium.Math.toRadians(-28),
            roll: 0,
          },
          duration: 1.4,
        });
        break;
      case "south":
        // Direct southern vantage facing North
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(79.0, 0.0, 2500000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-36),
            roll: 0,
          },
          duration: 1.4,
        });
        break;
      case "top":
        // 2D Nadir Map Perspective
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(79.0, 15.0, 2700000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-89),
            roll: 0,
          },
          duration: 1.4,
        });
        break;
    }
  }, []);

  const adjustTilt = useCallback((deltaDegrees: number) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed?.()) return;
    const camera = viewer.camera;
    const currentPitchDeg = Cesium.Math.toDegrees(camera.pitch);
    const newPitchDeg = Math.max(-89, Math.min(-15, currentPitchDeg + deltaDegrees));
    const pos = camera.positionCartographic;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, pos.height),
      orientation: {
        heading: camera.heading,
        pitch: Cesium.Math.toRadians(newPitchDeg),
        roll: 0,
      },
      duration: 0.3,
    });
  }, []);

  const adjustRotate = useCallback((deltaDegrees: number) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed?.()) return;
    const camera = viewer.camera;
    const currentHeadingDeg = Cesium.Math.toDegrees(camera.heading);
    const newHeadingDeg = (currentHeadingDeg + deltaDegrees) % 360;
    const pos = camera.positionCartographic;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, pos.height),
      orientation: {
        heading: Cesium.Math.toRadians(newHeadingDeg),
        pitch: camera.pitch,
        roll: 0,
      },
      duration: 0.3,
    });
  }, []);

  const adjustZoom = useCallback((inOut: "in" | "out") => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed?.()) return;
    const camera = viewer.camera;
    const h = camera.positionCartographic.height;
    if (inOut === "in") {
      camera.zoomIn(h * 0.22);
    } else {
      camera.zoomOut(h * 0.22);
    }
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

    // Intuitive Modern 3D Controls (Google Earth / CAD / GIS standard):
    // Left drag: Pan / Rotate globe
    // Right drag: TILT / PITCH (Orbit 3D perspective angle)
    // Wheel / Pinch: Zoom
    const controller = viewer.scene.screenSpaceCameraController;
    controller.enableCollisionDetection = false;
    controller.tiltEventTypes = [
      Cesium.CameraEventType.RIGHT_DRAG,
      Cesium.CameraEventType.MIDDLE_DRAG,
      { eventType: Cesium.CameraEventType.LEFT_DRAG, modifier: Cesium.KeyboardEventModifier.CTRL },
      { eventType: Cesium.CameraEventType.LEFT_DRAG, modifier: Cesium.KeyboardEventModifier.SHIFT },
    ];
    controller.zoomEventTypes = [
      Cesium.CameraEventType.WHEEL,
      Cesium.CameraEventType.PINCH,
    ];
    controller.rotateEventTypes = [
      Cesium.CameraEventType.LEFT_DRAG,
    ];

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

  // Dynamically toggle globe translucency and unlock 3D camera controls for volumetric mode
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed?.()) return;

    if (viewMode === "volumetric") {
      viewer.scene.globe.translucency.enabled = true;
      viewer.scene.globe.translucency.frontFaceAlpha = 0.35;
      viewer.scene.globe.translucency.backFaceAlpha = 0.15;
      viewer.scene.globe.undergroundColor = Cesium.Color.BLACK.withAlpha(0.0);
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
      viewer.scene.globe.depthTestAgainstTerrain = false;
    } else {
      viewer.scene.globe.translucency.enabled = false;
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
      viewer.scene.globe.depthTestAgainstTerrain = false;
    }
  }, [viewMode]);

  // Dynamic Mouse Interaction Controller: Switch between standard pan and free 3D tilt mode
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed?.()) return;
    const controller = viewer.scene.screenSpaceCameraController;

    if (mouseMode === "tilt") {
      // Free 3D Tilt Mode: Direct Left-Click Drag tilts & pitches the camera in 3D!
      controller.rotateEventTypes = [];
      controller.tiltEventTypes = [
        Cesium.CameraEventType.LEFT_DRAG,
        Cesium.CameraEventType.RIGHT_DRAG,
        Cesium.CameraEventType.MIDDLE_DRAG,
      ];
    } else {
      // Standard Orbit / Pan Mode
      controller.rotateEventTypes = [Cesium.CameraEventType.LEFT_DRAG];
      controller.tiltEventTypes = [
        Cesium.CameraEventType.RIGHT_DRAG,
        Cesium.CameraEventType.MIDDLE_DRAG,
        { eventType: Cesium.CameraEventType.LEFT_DRAG, modifier: Cesium.KeyboardEventModifier.CTRL },
        { eventType: Cesium.CameraEventType.LEFT_DRAG, modifier: Cesium.KeyboardEventModifier.SHIFT },
      ];
    }
  }, [mouseMode]);

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
    if (!viewer || viewer.isDestroyed?.() || !viewer.imageryLayers) return;

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
    if (hasSliceRange) {
      onSliceDataCalculated?.(selectedVariable, depthIndex, sliceMin, sliceMax);
    }
    const minVal = colorbarConfig?.min ?? (hasSliceRange ? sliceMin : currentVariableMeta?.min ?? 0);
    const maxVal = colorbarConfig?.max ?? (hasSliceRange ? sliceMax : currentVariableMeta?.max ?? 30);
    const palette = colorbarConfig?.palette ?? currentVariableMeta?.palette ?? "thermal";
    const scaleType = colorbarConfig?.scaleType ?? "linear";

    const cacheKey = `${selectedVariable}_${timeIndex}_${depthIndex}_${minVal.toFixed(2)}_${maxVal.toFixed(2)}_${palette}_${scaleType}`;
    const dataUrl = getCachedTexture(
      tileData.values,
      minVal,
      maxVal,
      palette,
      scaleType,
      cacheKey,
      1024
    );

    try {
      const provider = new Cesium.SingleTileImageryProvider({
        url: dataUrl,
        rectangle: MODEL_GRID_RECTANGLE,
        tileWidth: 1024,
        tileHeight: 1024,
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
        newLayer.alpha = t * 0.72;

        if (oldLayer && viewer.imageryLayers.contains(oldLayer)) {
          oldLayer.alpha = (1.0 - t) * 0.72;
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
    viewMode,
    currentVariableMeta,
    colorbarConfig,
    depthIndex,
    timeIndex,
    selectedVariable,
    getCachedTexture,
    onSliceDataCalculated,
  ]);

  // Update 3D Volumetric Depth Slices Stack with memoized textures
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewMode !== "volumetric" || volumetricSlices.length === 0) return;

    clearVolumetricEntities();

    // 1. Calculate dynamic water column range across all loaded depth slices
    let volMin = Infinity;
    let volMax = -Infinity;
    volumetricSlices.forEach((slice) => {
      if (!slice.values) return;
      for (let r = 0; r < slice.values.length; r++) {
        const row = slice.values[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          const v = row[c];
          if (v !== null && !isNaN(v)) {
            if (v < volMin) volMin = v;
            if (v > volMax) volMax = v;
          }
        }
      }
    });

    const hasVolRange = volMin !== Infinity && volMax !== -Infinity && volMax > volMin;
    const colMin = hasVolRange ? volMin : (currentVariableMeta?.min ?? 0);
    const colMax = hasVolRange ? volMax : (currentVariableMeta?.max ?? 30);
    const palette = colorbarConfig?.palette ?? currentVariableMeta?.palette ?? "thermal";
    const scaleType = colorbarConfig?.scaleType ?? "linear";

    if (hasVolRange) {
      onSliceDataCalculated?.(selectedVariable, -1, volMin, volMax);
    }

    // Exploded 3D Water Column: Natural physical stratification elevated above seafloor
    // Layer 1 (Surface) is at the top; Layer 4 (Abyssal) is at the base
    const exScale = Math.max(0.4, Math.min(4.0, verticalExaggeration / 100));
    const BASE_HEIGHT = 15000;
    const LAYER_GAP = 105000 * exScale;
    const LAYER_ALTITUDES = [
      BASE_HEIGHT + LAYER_GAP * 3, // Layer 1: Sea Surface (0.5m) -> highest
      BASE_HEIGHT + LAYER_GAP * 2, // Layer 2: Mixed Base (50m)
      BASE_HEIGHT + LAYER_GAP * 1, // Layer 3: Thermocline (200m)
      BASE_HEIGHT,                 // Layer 4: Deep Abyssal (1000m) -> base
    ];

    const createdEntities: Cesium.Entity[] = [];

    // 2. Add 4 Glowing Cyan Depth Guide Pillars at the corners of India's EEZ domain
    const CORNER_COORDS = [
      [68.0, 6.0],  // SW
      [90.0, 6.0],  // SE
      [90.0, 25.0], // NE
      [68.0, 25.0], // NW
    ];

    CORNER_COORDS.forEach(([lon, lat], cIdx) => {
      const pillar = viewer.entities.add({
        name: `Depth Guide Pillar ${cIdx + 1}`,
        polyline: {
          positions: [
            Cesium.Cartesian3.fromDegrees(lon, lat, LAYER_ALTITUDES[0] + 12000),
            Cesium.Cartesian3.fromDegrees(lon, lat, BASE_HEIGHT),
          ],
          width: 3.5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.35,
            color: Cesium.Color.CYAN.withAlpha(0.95),
          }),
        },
      });
      createdEntities.push(pillar);
    });

    // 3. Render each depth slice plane with slice-specific contrast and informative labels
    volumetricSlices.forEach((slice, idx) => {
      if (!slice.values) return;
      // If user toggled this layer off in HUD, skip rendering it so they can see deeper layers
      if (visibleLayers[idx] === false) return;

      const labelText = VOLUMETRIC_LABELS[idx] ?? `Layer ${idx + 1}`;
      const altitude = LAYER_ALTITUDES[idx] ?? (BASE_HEIGHT + (3 - idx) * LAYER_GAP);

      // Compute slice-specific contrast to reveal real internal eddies and currents
      let sMin = Infinity;
      let sMax = -Infinity;
      for (let r = 0; r < slice.values.length; r++) {
        const row = slice.values[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          const v = row[c];
          if (v !== null && !isNaN(v)) {
            if (v < sMin) sMin = v;
            if (v > sMax) sMax = v;
          }
        }
      }
      const hasSliceContrast = sMin !== Infinity && sMax !== -Infinity && sMax > sMin;
      const sliceMinVal = hasSliceContrast ? sMin : colMin;
      const sliceMaxVal = hasSliceContrast ? sMax : colMax;

      const cacheKey = `vol_${selectedVariable}_${timeIndex}_${idx}_${sliceMinVal.toFixed(2)}_${sliceMaxVal.toFixed(2)}_${palette}_${scaleType}`;
      const dataUrl = getCachedTexture(
        slice.values,
        sliceMinVal,
        sliceMaxVal,
        palette,
        scaleType,
        cacheKey,
        512
      );

      const sliceEntity = viewer.entities.add({
        name: `Volumetric Slice ${labelText}`,
        rectangle: {
          coordinates: MODEL_GRID_RECTANGLE,
          height: altitude,
          material: new Cesium.ImageMaterialProperty({
            image: dataUrl,
            transparent: true,
            color: Cesium.Color.WHITE.withAlpha(sliceOpacity),
          }),
          outline: true,
          outlineColor: Cesium.Color.CYAN.withAlpha(0.85),
          outlineWidth: 2.5,
        },
      });
      createdEntities.push(sliceEntity);

      const unit = currentVariableMeta?.units ?? "°C";
      const rangeTag = hasSliceContrast
        ? ` (${sMin.toFixed(1)}–${sMax.toFixed(1)} ${unit})`
        : "";

      const labelEntity = viewer.entities.add({
        name: `Label ${labelText}`,
        position: Cesium.Cartesian3.fromDegrees(90.5, 7.0 + idx * 4.2, altitude),
        label: {
          text: `${labelText}${rangeTag}`,
          font: "bold 13px monospace",
          fillColor: Cesium.Color.fromCssColorString("#00f2a9"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 4,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(14, 0),
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          scaleByDistance: new Cesium.NearFarScalar(500000, 1.0, 7000000, 0.5),
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
    sliceOpacity,
    visibleLayers,
    clearVolumetricEntities,
    colorbarConfig,
    getCachedTexture,
    selectedVariable,
    timeIndex,
    onSliceDataCalculated,
  ]);

  // ── Current Vector Arrow Rendering ────────────────────────────────────
  // Renders subsampled uo/vo arrow polylines when a current variable is active.
  // Each arrow: tail at grid point, head displaced by (uo, vo) scaled to scene.
  // Arrows are colored by speed magnitude (blue→white→red gradient).
  useEffect(() => {
    const viewer = viewerRef.current;

    // Clear any existing arrows first
    if (arrowEntitiesRef.current.length > 0) {
      arrowEntitiesRef.current.forEach((e) => viewer?.entities.remove(e));
      arrowEntitiesRef.current = [];
    }

    const CURRENT_VARS = ["uo", "vo", "cur_speed"];
    if (!viewer || viewer.isDestroyed?.() || viewMode === "volumetric") return;
    if (!CURRENT_VARS.includes(selectedVariable)) return;
    if (!tileData?.values) return;

    // Fetch both uo and vo so we always have both components for true direction
    Promise.all([
      getField("uo", timeIndex, depthIndex).catch(() => null),
      getField("vo", timeIndex, depthIndex).catch(() => null),
    ]).then(([uoTile, voTile]) => {
      if (!uoTile || !voTile) return;
      const v = viewerRef.current;
      if (!v || v.isDestroyed?.()) return;

      const latGrid = uoTile.lat_grid;
      const lonGrid = uoTile.lon_grid;
      const uoVals = uoTile.values;
      const voVals = voTile.values;

      const nLat = latGrid.length;
      const nLon = lonGrid.length;

      // Subsample: show every Nth point to keep entity count manageable
      // At 77×89 grid → ~6853 points; show every 4th → ~428 arrows
      const STRIDE = 4;
      // Scale factor: 1 m/s current → ~1.5° of lat/lon displacement on arrow
      const ARROW_SCALE = 1.5;

      const newEntities: Cesium.Entity[] = [];

      for (let ri = 0; ri < nLat; ri += STRIDE) {
        for (let ci = 0; ci < nLon; ci += STRIDE) {
          const uo = uoVals[ri]?.[ci];
          const vo = voVals[ri]?.[ci];
          if (uo == null || vo == null || isNaN(uo) || isNaN(vo)) continue;

          const speed = Math.sqrt(uo * uo + vo * vo);
          if (speed < 0.01) continue; // skip near-zero currents

          const baseLat = latGrid[ri];
          const baseLon = lonGrid[ci];
          // Arrow tip: displace by (uo→east=lon, vo→north=lat)
          const tipLat = baseLat + vo * ARROW_SCALE;
          const tipLon = baseLon + uo * ARROW_SCALE;

          // Color by speed: slow=cyan, medium=white, fast=orange-red
          const maxSpeed = 0.6;
          const t = Math.min(1.0, speed / maxSpeed);
          let arrowColor: Cesium.Color;
          if (t < 0.5) {
            // cyan → white
            const s = t * 2;
            arrowColor = Cesium.Color.fromCssColorString(
              `rgb(${Math.round(0 + 255 * s)}, ${Math.round(210 + 45 * s)}, 255)`
            );
          } else {
            // white → orange-red
            const s = (t - 0.5) * 2;
            arrowColor = Cesium.Color.fromCssColorString(
              `rgb(255, ${Math.round(255 - 165 * s)}, ${Math.round(255 - 255 * s)})`
            );
          }

          // Arrow shaft
          const shaft = v.entities.add({
            name: `CurrentArrow_${ri}_${ci}`,
            polyline: {
              positions: [
                Cesium.Cartesian3.fromDegrees(baseLon, baseLat, 200),
                Cesium.Cartesian3.fromDegrees(tipLon, tipLat, 200),
              ],
              width: 1.8,
              clampToGround: false,
              material: arrowColor.withAlpha(0.75),
            },
          });
          newEntities.push(shaft);

          // Arrowhead: small point at tip
          const head = v.entities.add({
            name: `CurrentArrowHead_${ri}_${ci}`,
            position: Cesium.Cartesian3.fromDegrees(tipLon, tipLat, 220),
            point: {
              pixelSize: 3.5,
              color: arrowColor.withAlpha(0.85),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
          newEntities.push(head);
        }
      }

      arrowEntitiesRef.current = newEntities;
    });

    return () => {
      const v = viewerRef.current;
      arrowEntitiesRef.current.forEach((e) => v?.entities.remove(e));
      arrowEntitiesRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariable, timeIndex, depthIndex, viewMode, tileData]);

  // ── Handle Left Click: Pick Argo float markers and Glider trajectories
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

      {/* 3D Geospatial Navigation & Volumetric Camera HUD — hidden when right panel is toggled off */}
      <div
        className={`absolute bottom-12 right-4 md:right-6 z-30 flex flex-col items-end gap-2 pointer-events-auto select-none transition-all duration-300 ${
          rightPanelOpen
            ? "opacity-100 translate-x-0"
            : "opacity-0 translate-x-8 pointer-events-none"
        }`}
      >
        {/* Helper Hint Toast */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full ocean-glass border border-cyan-500/30 text-[11px] text-cyan-200 shadow-xl backdrop-blur-md">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            {mouseMode === "tilt" ? (
              <span className="text-emerald-300 font-semibold">
                🕹️ Left-Drag to Tilt 3D Angle · Wheel to Zoom
              </span>
            ) : (
              <span>
                Left-Drag: Pan · <strong>Right-Drag / Ctrl+Drag: Tilt 3D</strong> · Wheel: Zoom
              </span>
            )}
          </span>
        </div>

        {/* Collapsed Toggle Pill */}
        {!isHudExpanded ? (
          <button
            onClick={() => setIsHudExpanded(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl ocean-glass border border-cyan-400/50 text-cyan-300 text-xs font-semibold shadow-xl hover:border-cyan-300 hover:text-white transition-all backdrop-blur-md"
          >
            <Box className="w-4 h-4 text-emerald-400" />
            <span>3D Camera Controls</span>
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          </button>
        ) : (
          /* Main 3D Camera Deck Panel */
          <div className="ocean-glass rounded-2xl border border-cyan-500/40 p-3 shadow-2xl backdrop-blur-xl bg-slate-950/85 w-72 space-y-2.5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                <Box className="w-4 h-4 text-emerald-400" />
                <span>3D Camera Deck</span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Mouse Drag Mode Toggle */}
                <button
                  onClick={() => setMouseMode((m) => (m === "pan" ? "tilt" : "pan"))}
                  title="Toggle Left-Click Drag Mode between 3D Tilt and Globe Pan"
                  className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold flex items-center gap-1 transition-all ${
                    mouseMode === "tilt"
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/70 shadow-sm shadow-emerald-500/30"
                      : "bg-slate-800/80 text-slate-400 border border-slate-700/60 hover:text-slate-200"
                  }`}
                >
                  {mouseMode === "tilt" ? "🕹️ Left: Tilt 3D" : "🖱️ Left: Pan"}
                </button>

                {/* Minimize Button */}
                <button
                  onClick={() => setIsHudExpanded(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all"
                  title="Minimize Panel"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick 3D Perspectives */}
            <div className="space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Camera Angles
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => flyToPreset("oblique")}
                  className="px-2 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 hover:border-cyan-400/60 text-slate-200 hover:text-cyan-300 text-xs font-medium transition-all text-left flex items-center gap-1.5"
                >
                  <span>💎</span>
                  <span>3D Oblique</span>
                </button>
                <button
                  onClick={() => flyToPreset("side")}
                  className="px-2 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 hover:border-cyan-400/60 text-slate-200 hover:text-cyan-300 text-xs font-medium transition-all text-left flex items-center gap-1.5"
                >
                  <span>🌊</span>
                  <span>Side Profile</span>
                </button>
                <button
                  onClick={() => flyToPreset("south")}
                  className="px-2 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 hover:border-cyan-400/60 text-slate-200 hover:text-cyan-300 text-xs font-medium transition-all text-left flex items-center gap-1.5"
                >
                  <span>🧭</span>
                  <span>South Front</span>
                </button>
                <button
                  onClick={() => flyToPreset("top")}
                  className="px-2 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 hover:border-cyan-400/60 text-slate-200 hover:text-cyan-300 text-xs font-medium transition-all text-left flex items-center gap-1.5"
                >
                  <span>🗺️</span>
                  <span>Top-Down</span>
                </button>
              </div>
            </div>

            {/* Direct Adjustment Arrows (Click to fine-tune angle) */}
            <div className="space-y-1 pt-1 border-t border-slate-800/80">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex justify-between">
                <span>Manual Tweak</span>
                <span className="font-mono text-slate-400 text-[9px]">Fine Adjustment</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center">
                {/* Tilt Up */}
                <button
                  onClick={() => adjustTilt(6)}
                  title="Tilt Pitch Up (view from lower angle)"
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-400/60 text-slate-300 hover:text-cyan-300 text-xs font-mono flex flex-col items-center gap-0.5 transition-all"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[9px]">Tilt Up</span>
                </button>

                {/* Orbit Left */}
                <button
                  onClick={() => adjustRotate(-15)}
                  title="Orbit Left (-15°)"
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-400/60 text-slate-300 hover:text-cyan-300 text-xs font-mono flex flex-col items-center gap-0.5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-[9px]">Orbit L</span>
                </button>

                {/* Orbit Right */}
                <button
                  onClick={() => adjustRotate(15)}
                  title="Orbit Right (+15°)"
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-400/60 text-slate-300 hover:text-cyan-300 text-xs font-mono flex flex-col items-center gap-0.5 transition-all"
                >
                  <RotateCw className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-[9px]">Orbit R</span>
                </button>

                {/* Tilt Down */}
                <button
                  onClick={() => adjustTilt(-6)}
                  title="Tilt Pitch Down (view from higher angle)"
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-400/60 text-slate-300 hover:text-cyan-300 text-xs font-mono flex flex-col items-center gap-0.5 transition-all"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[9px]">Tilt Dn</span>
                </button>

                {/* Zoom In */}
                <button
                  onClick={() => adjustZoom("in")}
                  title="Zoom In"
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-400/60 text-slate-300 hover:text-cyan-300 text-xs font-mono flex flex-col items-center gap-0.5 transition-all"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[9px]">Zoom In</span>
                </button>

                {/* Zoom Out */}
                <button
                  onClick={() => adjustZoom("out")}
                  title="Zoom Out"
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-400/60 text-slate-300 hover:text-cyan-300 text-xs font-mono flex flex-col items-center gap-0.5 transition-all"
                >
                  <ZoomOut className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[9px]">Zoom Out</span>
                </button>
              </div>
            </div>

            {/* Volumetric Layer Filtering & Opacity (Active only in 3D Volumetric Mode) */}
            {viewMode === "volumetric" && (
              <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  <span>Layer Isolator</span>
                  <span className="text-slate-400 font-mono text-[9px]">Toggle Depth</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  {[
                    { id: 0, label: "0.5m Surface", color: "text-amber-300" },
                    { id: 1, label: "50m Mixed", color: "text-emerald-300" },
                    { id: 2, label: "200m Thermo", color: "text-cyan-300" },
                    { id: 3, label: "1000m Abyss", color: "text-blue-300" },
                  ].map((l) => (
                    <button
                      key={l.id}
                      onClick={() =>
                        setVisibleLayers((prev) => ({
                          ...prev,
                          [l.id]: !prev[l.id],
                        }))
                      }
                      className={`px-2 py-1 rounded border flex items-center justify-between transition-all ${
                        visibleLayers[l.id]
                          ? "bg-slate-900/90 border-cyan-500/40 text-slate-200"
                          : "bg-slate-950/60 border-slate-800 text-slate-500 line-through"
                      }`}
                    >
                      <span className={visibleLayers[l.id] ? l.color : ""}>{l.label}</span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          visibleLayers[l.id] ? "bg-cyan-400 shadow-sm shadow-cyan-400" : "bg-slate-700"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {/* Opacity Slider */}
                <div className="pt-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Layer Opacity</span>
                    <span className="font-mono text-cyan-300">{Math.round(sliceOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={0.95}
                    step={0.05}
                    value={sliceOpacity}
                    onChange={(e) => setSliceOpacity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
