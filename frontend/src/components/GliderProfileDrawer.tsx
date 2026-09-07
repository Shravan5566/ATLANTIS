"use client";

import React, { useState, useMemo } from "react";
import { GliderTrackItem, GliderPoint } from "@/lib/api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  X,
  Navigation,
  Calendar,
  Compass,
  Layers,
  Thermometer,
  Droplets,
  Activity,
  Waves,
  Table as TableIcon,
  ExternalLink,
} from "lucide-react";

interface GliderProfileDrawerProps {
  selectedGlider: GliderTrackItem | null;
  onClose: () => void;
}

export default function GliderProfileDrawer({
  selectedGlider,
  onClose,
}: GliderProfileDrawerProps) {
  const [activeParam, setActiveParam] = useState<"both" | "temperature" | "salinity">("both");
  const [chartMode, setChartMode] = useState<"depth_profile" | "undulation" | "table">("depth_profile");

  // Calculate statistics from glider track points
  const stats = useMemo(() => {
    if (!selectedGlider || selectedGlider.points.length === 0) {
      return {
        minDepth: 0,
        maxDepth: 1000,
        avgTemp: null,
        minTemp: null,
        maxTemp: null,
        avgSal: null,
        totalPoints: 0,
        startTime: null,
        endTime: null,
      };
    }

    const pts = selectedGlider.points;
    let minD = Infinity;
    let maxD = -Infinity;
    let sumT = 0;
    let countT = 0;
    let minT = Infinity;
    let maxT = -Infinity;
    let sumS = 0;
    let countS = 0;

    pts.forEach((p) => {
      if (p.depth != null) {
        if (p.depth < minD) minD = p.depth;
        if (p.depth > maxD) maxD = p.depth;
      }
      if (p.temperature != null) {
        sumT += p.temperature;
        countT++;
        if (p.temperature < minT) minT = p.temperature;
        if (p.temperature > maxT) maxT = p.temperature;
      }
      if (p.salinity != null) {
        sumS += p.salinity;
        countS++;
      }
    });

    return {
      minDepth: minD === Infinity ? 0 : Math.round(minD * 10) / 10,
      maxDepth: maxD === -Infinity ? 1000 : Math.round(maxD * 10) / 10,
      avgTemp: countT > 0 ? Math.round((sumT / countT) * 10) / 10 : null,
      minTemp: minT === Infinity ? null : Math.round(minT * 10) / 10,
      maxTemp: maxT === -Infinity ? null : Math.round(maxT * 10) / 10,
      avgSal: countS > 0 ? Math.round((sumS / countS) * 10) / 10 : null,
      totalPoints: pts.length,
      startTime: selectedGlider.time_start || pts[0]?.time,
      endTime: selectedGlider.time_end || pts[pts.length - 1]?.time,
    };
  }, [selectedGlider]);

  // Depth-binned CTD Profile data (aggregates multiple undulations into clean depth profile)
  const depthProfileData = useMemo(() => {
    if (!selectedGlider) return [];

    // Filter points that have temperature or salinity
    const valid = selectedGlider.points.filter(
      (p) => p.depth != null && (p.temperature != null || p.salinity != null)
    );

    // Sort by depth ascending
    return [...valid]
      .sort((a, b) => a.depth - b.depth)
      .map((p, idx) => ({
        index: idx,
        depth: Math.round(p.depth * 10) / 10,
        temperature: p.temperature != null ? Math.round(p.temperature * 100) / 100 : null,
        salinity: p.salinity != null ? Math.round(p.salinity * 100) / 100 : null,
        time: p.time,
      }));
  }, [selectedGlider]);

  // Transect Undulation data (Depth vs Step/Time)
  const undulationData = useMemo(() => {
    if (!selectedGlider) return [];
    return selectedGlider.points.map((p, idx) => ({
      step: idx + 1,
      timeLabel: p.time ? new Date(p.time).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : `#${idx + 1}`,
      depth: Math.round(p.depth * 10) / 10,
      temperature: p.temperature != null ? Math.round(p.temperature * 100) / 100 : null,
      salinity: p.salinity != null ? Math.round(p.salinity * 100) / 100 : null,
      lat: p.lat,
      lon: p.lon,
    }));
  }, [selectedGlider]);

  if (!selectedGlider) return null;

  return (
    <aside className="fixed top-16 right-0 bottom-10 w-96 sm:w-[450px] z-50 ocean-glass border-l border-amber-500/30 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-amber-500/20 flex items-center justify-between bg-slate-950/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-400/50 text-amber-400">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Glider #{selectedGlider.glider_id}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-400/40">
                Autonomous Glider
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Autonomous Sub-surface CTD Trajectory
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Glider Meta Stats Grid */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/40 grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded-lg ocean-glass-subtle space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Mission Trajectory</span>
          </div>
          <div className="font-mono font-bold text-white text-[11px]">
            {selectedGlider.points[0]?.lat.toFixed(2)}°N, {selectedGlider.points[0]?.lon.toFixed(2)}°E
          </div>
        </div>

        <div className="p-2 rounded-lg ocean-glass-subtle space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            <span>Dive Depth Span</span>
          </div>
          <div className="font-mono font-bold text-white">
            {stats.minDepth}m – {stats.maxDepth}m
          </div>
        </div>

        <div className="col-span-2 p-2 rounded-lg ocean-glass-subtle flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>Mission Period</span>
          </div>
          <div className="font-mono text-amber-300 font-medium text-[11px]">
            {stats.startTime
              ? new Date(stats.startTime).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Active"}{" "}
            →{" "}
            {stats.endTime
              ? new Date(stats.endTime).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Present"}
          </div>
        </div>
      </div>

      {/* View Mode & Parameter Filter Bar */}
      <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between gap-2 text-xs">
        {/* Mode Toggle */}
        <div className="flex rounded-lg border border-slate-700 overflow-hidden text-[11px]">
          <button
            onClick={() => setChartMode("depth_profile")}
            className={`flex items-center gap-1 px-2.5 py-1.5 transition-all ${
              chartMode === "depth_profile"
                ? "bg-amber-600 text-white font-bold"
                : "bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>CTD Profile</span>
          </button>
          <button
            onClick={() => setChartMode("undulation")}
            className={`flex items-center gap-1 px-2.5 py-1.5 transition-all ${
              chartMode === "undulation"
                ? "bg-amber-600 text-white font-bold"
                : "bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Waves className="w-3 h-3" />
            <span>Undulations</span>
          </button>
          <button
            onClick={() => setChartMode("table")}
            className={`flex items-center gap-1 px-2.5 py-1.5 transition-all ${
              chartMode === "table"
                ? "bg-amber-600 text-white font-bold"
                : "bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
          >
            <TableIcon className="w-3 h-3" />
            <span>Raw Data</span>
          </button>
        </div>

        {/* Param Filter */}
        <div className="flex rounded-lg border border-slate-700 overflow-hidden text-[11px]">
          <button
            onClick={() => setActiveParam("both")}
            className={`px-2 py-1.5 ${
              activeParam === "both"
                ? "bg-cyan-600 text-white font-bold"
                : "bg-slate-900 text-slate-400"
            }`}
          >
            Both
          </button>
          <button
            onClick={() => setActiveParam("temperature")}
            className={`px-2 py-1.5 ${
              activeParam === "temperature"
                ? "bg-rose-600 text-white font-bold"
                : "bg-slate-900 text-slate-400"
            }`}
          >
            Temp
          </button>
          <button
            onClick={() => setActiveParam("salinity")}
            className={`px-2 py-1.5 ${
              activeParam === "salinity"
                ? "bg-cyan-600 text-white font-bold"
                : "bg-slate-900 text-slate-400"
            }`}
          >
            Sal
          </button>
        </div>
      </div>

      {/* Chart Body */}
      <div className="flex-1 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 text-xs">
            {(activeParam === "both" || activeParam === "temperature") && (
              <div className="flex items-center gap-1.5 text-rose-400 font-semibold">
                <Thermometer className="w-3.5 h-3.5" />
                <span>Temp (°C)</span>
              </div>
            )}
            {(activeParam === "both" || activeParam === "salinity") && (
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Droplets className="w-3.5 h-3.5" />
                <span>Salinity (PSU)</span>
              </div>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-mono italic">
            {chartMode === "depth_profile"
              ? "Y: Depth Inverted (0m Surface)"
              : "Y: Undulating Dive Depth (m)"}
          </span>
        </div>

        <div className="flex-1 w-full min-h-[300px] bg-slate-950/60 rounded-xl p-2 border border-slate-800/80">
          {chartMode === "depth_profile" ? (
            /* Mode 1: Depth Inverted CTD Profile */
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={depthProfileData}
                layout="vertical"
                margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <YAxis
                  dataKey="depth"
                  type="number"
                  reversed={true}
                  stroke="#94a3b8"
                  fontSize={10}
                  tickFormatter={(val) => `${val}m`}
                  domain={[0, "dataMax"]}
                />

                {/* Dual Independent X-Axes for Temperature and Salinity */}
                {activeParam === "both" && (
                  <>
                    <XAxis
                      xAxisId="temp"
                      type="number"
                      orientation="bottom"
                      stroke="#f43f5e"
                      fontSize={10}
                      domain={["dataMin - 0.5", "dataMax + 0.5"]}
                      tickFormatter={(val) => `${val}°C`}
                    />
                    <XAxis
                      xAxisId="sal"
                      type="number"
                      orientation="top"
                      stroke="#00d2ff"
                      fontSize={10}
                      domain={["dataMin - 0.2", "dataMax + 0.2"]}
                      tickFormatter={(val) => `${val} PSU`}
                    />
                  </>
                )}

                {activeParam === "temperature" && (
                  <XAxis
                    xAxisId="temp"
                    type="number"
                    orientation="bottom"
                    stroke="#f43f5e"
                    fontSize={10}
                    domain={["dataMin - 0.5", "dataMax + 0.5"]}
                    tickFormatter={(val) => `${val}°C`}
                  />
                )}

                {activeParam === "salinity" && (
                  <XAxis
                    xAxisId="sal"
                    type="number"
                    orientation="bottom"
                    stroke="#00d2ff"
                    fontSize={10}
                    domain={["dataMin - 0.2", "dataMax + 0.2"]}
                    tickFormatter={(val) => `${val} PSU`}
                  />
                )}

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="ocean-glass p-2.5 rounded-lg border border-amber-500/30 text-xs space-y-1 shadow-xl">
                          <p className="font-bold text-amber-300">Depth: {label} m</p>
                          {payload.map((item, idx) => (
                            <p key={idx} style={{ color: item.color }} className="font-mono">
                              {item.name}: {item.value} {item.name === "Temperature" ? "°C" : "PSU"}
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {(activeParam === "both" || activeParam === "temperature") && (
                  <Line
                    xAxisId="temp"
                    type="linear"
                    dataKey="temperature"
                    name="Temperature"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#f43f5e" }}
                  />
                )}
                {(activeParam === "both" || activeParam === "salinity") && (
                  <Line
                    xAxisId="sal"
                    type="linear"
                    dataKey="salinity"
                    name="Salinity"
                    stroke="#00d2ff"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#00d2ff" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : chartMode === "undulation" ? (
            /* Mode 2: Transect Undulation (Depth vs Time / Waypoint) */
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={undulationData}
                margin={{ top: 10, right: 15, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="timeLabel"
                  stroke="#94a3b8"
                  fontSize={10}
                  interval="preserveStartEnd"
                />
                <YAxis
                  dataKey="depth"
                  reversed={true}
                  stroke="#94a3b8"
                  fontSize={10}
                  tickFormatter={(val) => `${val}m`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="ocean-glass p-2.5 rounded-lg border border-amber-500/30 text-xs space-y-1 shadow-xl">
                          <p className="font-bold text-amber-300">Dive Point #{d.step}</p>
                          <p className="text-slate-300">Depth: <strong className="font-mono text-white">{d.depth}m</strong></p>
                          {d.temperature != null && (
                            <p className="text-rose-400 font-mono">Temp: {d.temperature}°C</p>
                          )}
                          {d.salinity != null && (
                            <p className="text-cyan-400 font-mono">Salinity: {d.salinity} PSU</p>
                          )}
                          <p className="text-[10px] text-slate-400 font-mono">
                            {d.lat.toFixed(2)}°N, {d.lon.toFixed(2)}°E
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="linear"
                  dataKey="depth"
                  name="Dive Trajectory"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: "#f59e0b" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            /* Mode 3: Raw Observation Data Table */
            <div className="w-full h-full overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/80">
              <table className="w-full text-left text-xs font-mono">
                <thead className="sticky top-0 bg-slate-900/95 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800 z-10">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Depth (m)</th>
                    <th className="py-2.5 px-3 text-rose-400">Temp (°C)</th>
                    <th className="py-2.5 px-3 text-cyan-400">Salinity (PSU)</th>
                    <th className="py-2.5 px-3 text-slate-400">Lat, Lon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {selectedGlider.points.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-1 px-3 text-slate-500 text-[10px]">{idx + 1}</td>
                      <td className="py-1 px-3 text-white font-semibold">{p.depth} m</td>
                      <td className="py-1 px-3 text-rose-300">
                        {p.temperature !== null ? `${p.temperature.toFixed(2)} °C` : "—"}
                      </td>
                      <td className="py-1 px-3 text-cyan-300">
                        {p.salinity !== null ? `${p.salinity.toFixed(2)} PSU` : "—"}
                      </td>
                      <td className="py-1 px-3 text-[10px] text-slate-400">
                        {p.lat.toFixed(2)}°N, {p.lon.toFixed(2)}°E
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-950/80 border-t border-amber-500/20 flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span>Ifremer Ocean Glider ERDDAP · INCOIS</span>
        <span>{selectedGlider.points.length} Dive Points Sampled</span>
      </div>
    </aside>
  );
}
