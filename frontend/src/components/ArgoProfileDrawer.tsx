"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getArgoProfile, ArgoPositionItem, ArgoProfileItem } from "@/lib/api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  X,
  Anchor,
  Calendar,
  Compass,
  Layers,
  Thermometer,
  Droplets,
  Loader2,
  Maximize2,
  Table as TableIcon,
  ExternalLink,
  LineChart as LineChartIcon,
} from "lucide-react";

interface ArgoProfileDrawerProps {
  selectedFloat: ArgoPositionItem | null;
  onClose: () => void;
}

export default function ArgoProfileDrawer({
  selectedFloat,
  onClose,
}: ArgoProfileDrawerProps) {
  const [selectedCycle, setSelectedCycle] = useState<number | "all">("all");
  const [activeParam, setActiveParam] = useState<"both" | "temperature" | "salinity">("both");
  const [displayMode, setDisplayMode] = useState<"chart" | "table">("chart");

  // Reset selected cycle whenever a different Argo float is selected
  React.useEffect(() => {
    setSelectedCycle("all");
  }, [selectedFloat?.float_id]);

  // Fetch full profile history for selected float
  const { data: profiles, isLoading } = useQuery<ArgoProfileItem[]>({
    queryKey: ["argo-profile", selectedFloat?.float_id],
    queryFn: () => getArgoProfile(selectedFloat!.float_id),
    enabled: !!selectedFloat?.float_id,
  });

  // Extract distinct cycle numbers / timestamps for the dropdown
  const availableCycles = useMemo(() => {
    if (!profiles || profiles.length === 0) return [];
    const map = new Map<number, string>();
    profiles.forEach((p) => {
      const cNum = Number(p.cycle_number);
      if (!map.has(cNum)) {
        map.set(cNum, p.timestamp);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([cycle, time]) => ({ cycle, time }));
  }, [profiles]);

  // Filter profiles for selected cycle with resilient fallback
  const chartData = useMemo(() => {
    if (!profiles || profiles.length === 0) return [];
    let filtered = profiles;

    if (selectedCycle !== "all") {
      filtered = profiles.filter((p) => Number(p.cycle_number) === Number(selectedCycle));
    }

    // If filtering by selectedCycle returned no items, fallback to latest cycle from availableCycles
    if (filtered.length === 0 && availableCycles.length > 0) {
      const latestCycle = availableCycles[0].cycle;
      filtered = profiles.filter((p) => Number(p.cycle_number) === Number(latestCycle));
    }

    // Sort by depth ascending
    return [...filtered]
      .filter((p) => p.depth !== null && (p.temperature !== null || p.salinity !== null))
      .sort((a, b) => a.depth - b.depth)
      .map((p) => ({
        depth: Math.round(p.depth * 10) / 10,
        temperature: p.temperature !== null ? Math.round(p.temperature * 100) / 100 : null,
        salinity: p.salinity !== null ? Math.round(p.salinity * 100) / 100 : null,
      }));
  }, [profiles, selectedCycle, availableCycles]);

  if (!selectedFloat) return null;

  return (
    <aside className="fixed top-16 right-0 bottom-10 w-96 sm:w-[440px] z-50 ocean-glass border-l border-white/[0.08] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-400/25 text-sky-400">
            <Anchor className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Argo Float #{selectedFloat.float_id}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-300 border border-sky-400/25">
                WMO ID
              </span>
            </div>
            <p className="text-[11px] text-slate-400">In-Situ Autonomous Profiling Float</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Float Meta Stats Grid */}
      <div className="p-4 border-b border-white/[0.06] bg-slate-900/20 grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded-lg ocean-glass-subtle space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Position</span>
          </div>
          <div className="font-mono font-bold text-white">
            {selectedFloat.latitude.toFixed(2)}°N, {selectedFloat.longitude.toFixed(2)}°E
          </div>
        </div>

        <div className="p-2 rounded-lg ocean-glass-subtle space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            <span>Profile Depth</span>
          </div>
          <div className="font-mono font-bold text-white">
            {selectedFloat.min_depth}m – {selectedFloat.max_depth}m
          </div>
        </div>

        <div className="col-span-2 p-2 rounded-lg ocean-glass-subtle flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>Last Surface Transmission</span>
          </div>
          <div className="font-mono text-cyan-300 font-medium">
            {new Date(selectedFloat.timestamp).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            })} UTC
          </div>
        </div>
      </div>

      {/* Cycle Selector & Param Filter */}
      <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between gap-3 text-xs">
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Profiling Cycle
          </label>
          <select
            value={selectedCycle === "all" ? (availableCycles[0]?.cycle ?? "") : selectedCycle}
            onChange={(e) =>
              setSelectedCycle(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))
            }
            className="w-full bg-slate-900/80 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-400/50"
          >
            {availableCycles.map(({ cycle, time }) => (
              <option key={cycle} value={cycle}>
                Cycle {cycle} ({new Date(time).toLocaleDateString("en-IN", { month: "short", day: "numeric" })})
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle (Chart vs Raw Table) */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            View Mode
          </label>
          <div className="flex rounded-lg border border-white/[0.08] overflow-hidden text-[11px]">
            <button
              onClick={() => setDisplayMode("chart")}
              className={`flex items-center gap-1 px-2.5 py-1.5 transition-all ${
                displayMode === "chart" ? "ocean-glass-active text-white font-semibold" : "bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              <LineChartIcon className="w-3 h-3" />
              <span>Plot</span>
            </button>
            <button
              onClick={() => setDisplayMode("table")}
              className={`flex items-center gap-1 px-2.5 py-1.5 transition-all ${
                displayMode === "table" ? "ocean-glass-active text-white font-semibold" : "bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              <TableIcon className="w-3 h-3" />
              <span>Raw Data</span>
            </button>
          </div>
        </div>

        {/* Display Curve Filter */}
        {displayMode === "chart" && (
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Display Curve
            </label>
            <div className="flex rounded-lg border border-white/[0.08] overflow-hidden text-[11px]">
              <button
                onClick={() => setActiveParam("both")}
                className={`px-2 py-1.5 transition-all ${
                  activeParam === "both" ? "ocean-glass-active text-white font-semibold" : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                Both
              </button>
              <button
                onClick={() => setActiveParam("temperature")}
                className={`px-2 py-1.5 transition-all ${
                  activeParam === "temperature" ? "ocean-glass-active text-rose-300 font-semibold" : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                Temp
              </button>
              <button
                onClick={() => setActiveParam("salinity")}
                className={`px-2 py-1.5 transition-all ${
                  activeParam === "salinity" ? "ocean-glass-active text-sky-300 font-semibold" : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                Sal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chart / Table Body */}
      <div className="flex-1 p-4 flex flex-col min-h-0">
        <div className="mb-2">
          {displayMode === "chart" ? (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                {(activeParam === "both" || activeParam === "temperature") && (
                  <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-[11px]">
                    <Thermometer className="w-3.5 h-3.5" />
                    <span>Temp (°C)</span>
                  </div>
                )}
                {(activeParam === "both" || activeParam === "salinity") && (
                  <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-[11px]">
                    <Droplets className="w-3.5 h-3.5" />
                    <span>Salinity (PSU)</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono italic">
                Depth (0m Surface at Top)
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full text-xs text-slate-300">
              <span className="font-semibold flex items-center gap-1 text-cyan-300">
                <TableIcon className="w-3.5 h-3.5" />
                <span>Exact In-Situ Level Observations</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {chartData.length} Discrete Sensor Depths
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 w-full min-h-[300px] bg-slate-950/60 rounded-xl p-2 border border-slate-800/80 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-cyan-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Fetching in-situ CTD profile...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
              No depth measurement records available for this cycle.
            </div>
          ) : displayMode === "chart" ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                layout="vertical"
                margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

                {/* Oceanographic Depth Axis: 0m surface at top, 2000m deep at bottom */}
                <YAxis
                  dataKey="depth"
                  type="number"
                  reversed={false}
                  stroke="#94a3b8"
                  fontSize={10}
                  tickFormatter={(val) => `${Math.round(val)}m`}
                  domain={[0, "dataMax"]}
                />

                {/* Horizontal Scale(s): Dual Independent X-Axes for Temperature & Salinity */}
                {activeParam === "both" && (
                  <>
                    <XAxis
                      xAxisId="temp"
                      type="number"
                      orientation="bottom"
                      stroke="#f43f5e"
                      fontSize={10}
                      domain={[
                        (dataMin: number) => Math.floor(dataMin),
                        (dataMax: number) => Math.ceil(dataMax),
                      ]}
                      tickFormatter={(val) => `${Number(val).toFixed(1)}°C`}
                    />
                    <XAxis
                      xAxisId="sal"
                      type="number"
                      orientation="top"
                      stroke="#00d2ff"
                      fontSize={10}
                      domain={[
                        (dataMin: number) => Math.floor(dataMin * 10) / 10,
                        (dataMax: number) => Math.ceil(dataMax * 10) / 10,
                      ]}
                      tickFormatter={(val) => `${Number(val).toFixed(2)} PSU`}
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
                    domain={[
                      (dataMin: number) => Math.floor(dataMin),
                      (dataMax: number) => Math.ceil(dataMax),
                    ]}
                    tickFormatter={(val) => `${Number(val).toFixed(1)}°C`}
                  />
                )}

                {activeParam === "salinity" && (
                  <XAxis
                    xAxisId="sal"
                    type="number"
                    orientation="bottom"
                    stroke="#00d2ff"
                    fontSize={10}
                    domain={[
                      (dataMin: number) => Math.floor(dataMin * 10) / 10,
                      (dataMax: number) => Math.ceil(dataMax * 10) / 10,
                    ]}
                    tickFormatter={(val) => `${Number(val).toFixed(2)} PSU`}
                  />
                )}

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="ocean-glass p-2.5 rounded-lg border border-white/[0.1] text-xs space-y-1 shadow-xl">
                          <p className="font-bold text-sky-300">Depth: {label} m</p>
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
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#38bdf8" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            /* Mode 2: Exact Raw Data Table View */
            <div className="w-full h-full overflow-y-auto rounded-lg border border-white/[0.08] bg-slate-950/60">
              <table className="w-full text-left text-xs font-mono">
                <thead className="sticky top-0 bg-slate-900/95 text-[10px] text-slate-400 uppercase tracking-wider border-b border-white/[0.08] z-10">
                  <tr>
                    <th className="py-2.5 px-3">Depth (m)</th>
                    <th className="py-2.5 px-3 text-rose-400">Temperature (°C)</th>
                    <th className="py-2.5 px-3 text-sky-400">Salinity (PSU)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {chartData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.04] transition-colors">
                      <td className="py-1.5 px-3 text-white font-semibold">{row.depth} m</td>
                      <td className="py-1.5 px-3 text-rose-300">
                        {row.temperature !== null ? `${row.temperature.toFixed(2)} °C` : "—"}
                      </td>
                      <td className="py-1.5 px-3 text-sky-300">
                        {row.salinity !== null ? `${row.salinity.toFixed(2)} PSU` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info & Verification Links */}
      <div className="p-3 bg-slate-950/40 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span>Ifremer GDAC · INCOIS Hub</span>
          <a
            href={`https://fleetmonitoring.euro-argo.eu/float/${selectedFloat.float_id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-0.5 text-sky-400 hover:text-sky-300 underline underline-offset-2 ml-1"
          >
            <span>Euro-Argo WMO Live</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
        <span className="text-slate-300 font-bold">{chartData.length} Levels Sampled</span>
      </div>
    </aside>
  );
}
