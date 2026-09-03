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

  // Fetch full profile history for selected float
  const { data: profiles, isLoading } = useQuery<ArgoProfileItem[]>({
    queryKey: ["argo-profile", selectedFloat?.float_id],
    queryFn: () => getArgoProfile(selectedFloat!.float_id),
    enabled: !!selectedFloat?.float_id,
  });

  // Extract distinct cycle numbers / timestamps for the dropdown
  const availableCycles = useMemo(() => {
    if (!profiles) return [];
    const map = new Map<number, string>();
    profiles.forEach((p) => {
      if (!map.has(p.cycle_number)) {
        map.set(p.cycle_number, p.timestamp);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([cycle, time]) => ({ cycle, time }));
  }, [profiles]);

  // Filter profiles for selected cycle
  const chartData = useMemo(() => {
    if (!profiles) return [];
    let filtered = profiles;
    if (selectedCycle !== "all") {
      filtered = profiles.filter((p) => p.cycle_number === selectedCycle);
    } else if (availableCycles.length > 0) {
      // Default to latest cycle for cleaner visualization
      const latestCycle = availableCycles[0].cycle;
      filtered = profiles.filter((p) => p.cycle_number === latestCycle);
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
    <aside className="fixed top-16 right-0 bottom-10 w-96 sm:w-[440px] z-50 ocean-glass border-l border-cyan-500/20 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-slate-950/70">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-400/40 text-cyan-400">
            <Anchor className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Argo Float #{selectedFloat.float_id}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-400/30">
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
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/40 grid grid-cols-2 gap-2 text-xs">
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
            value={selectedCycle}
            onChange={(e) =>
              setSelectedCycle(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))
            }
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
          >
            {availableCycles.map(({ cycle, time }) => (
              <option key={cycle} value={cycle}>
                Cycle {cycle} ({new Date(time).toLocaleDateString("en-IN", { month: "short", day: "numeric" })})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Display Curve
          </label>
          <div className="flex rounded-lg border border-slate-700 overflow-hidden text-[11px]">
            <button
              onClick={() => setActiveParam("both")}
              className={`px-2 py-1.5 ${
                activeParam === "both" ? "bg-cyan-600 text-white font-bold" : "bg-slate-900 text-slate-400"
              }`}
            >
              Both
            </button>
            <button
              onClick={() => setActiveParam("temperature")}
              className={`px-2 py-1.5 ${
                activeParam === "temperature" ? "bg-rose-600 text-white font-bold" : "bg-slate-900 text-slate-400"
              }`}
            >
              Temp
            </button>
            <button
              onClick={() => setActiveParam("salinity")}
              className={`px-2 py-1.5 ${
                activeParam === "salinity" ? "bg-cyan-600 text-white font-bold" : "bg-slate-900 text-slate-400"
              }`}
            >
              Sal
            </button>
          </div>
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
            Y-Axis: Depth Inverted (0m Surface at Top)
          </span>
        </div>

        <div className="flex-1 w-full min-h-[300px] bg-slate-950/60 rounded-xl p-2 border border-slate-800/80">
          {isLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-cyan-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Fetching in-situ CTD profile...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
              No depth measurement records available for this cycle.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                layout="vertical"
                margin={{ top: 10, right: 15, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

                {/* Inverted Depth Axis (0 at top, 2000m at bottom) */}
                <YAxis
                  dataKey="depth"
                  type="number"
                  reversed={true}
                  stroke="#94a3b8"
                  fontSize={10}
                  tickFormatter={(val) => `${val}m`}
                  domain={["dataMin", "dataMax"]}
                />

                {/* Horizontal Value Axis */}
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  fontSize={10}
                  domain={["auto", "auto"]}
                />

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="ocean-glass p-2.5 rounded-lg border border-cyan-500/30 text-xs space-y-1 shadow-xl">
                          <p className="font-bold text-cyan-300">Depth: {label} m</p>
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
                    type="monotone"
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
                    type="monotone"
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
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-950/80 border-t border-cyan-500/20 flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span>Ifremer Argo GDAC · INCOIS Hub</span>
        <span>{chartData.length} Levels Sampled</span>
      </div>
    </aside>
  );
}
