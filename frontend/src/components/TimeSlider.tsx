"use client";

import React, { useEffect, useState } from "react";
import { Play, Pause, SkipForward, SkipBack, Calendar } from "lucide-react";

interface TimeSliderProps {
  timesteps: string[];
  timeIndex: number;
  onTimeChange: (index: number) => void;
}

export default function TimeSlider({ timesteps, timeIndex, onTimeChange }: TimeSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const totalSteps = timesteps.length || 1;

  // Animation Loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && totalSteps > 1) {
      interval = setInterval(() => {
        onTimeChange((timeIndex + 1) % totalSteps);
      }, 1500); // 1.5s per timestep
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, totalSteps, onTimeChange]);

  const currentTimeStr = timesteps[timeIndex]
    ? new Date(timesteps[timeIndex]).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "Live / Recent";

  const handlePrev = () => {
    onTimeChange(timeIndex > 0 ? timeIndex - 1 : totalSteps - 1);
  };

  const handleNext = () => {
    onTimeChange((timeIndex + 1) % totalSteps);
  };

  return (
    <div className="space-y-2.5 p-3.5 rounded-xl ocean-glass-subtle border border-cyan-500/20">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          <span>Observation Timestep</span>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-cyan-950/90 border border-cyan-400/40 text-cyan-300 font-mono font-bold text-xs">
          {currentTimeStr}
        </div>
      </div>

      {/* Play Controls & Slider */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          aria-label={isPlaying ? "Pause Animation" : "Play Animation"}
          className={`p-2 rounded-lg transition-all border ${
            isPlaying
              ? "bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/20"
              : "bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20"
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
        </button>

        <button
          onClick={handlePrev}
          title="Previous Step"
          className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(0, totalSteps - 1)}
          step={1}
          value={timeIndex}
          onChange={(e) => {
            setIsPlaying(false);
            onTimeChange(parseInt(e.target.value, 10));
          }}
          className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />

        <button
          onClick={handleNext}
          title="Next Step"
          className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
        <span>Step 1 of {totalSteps}</span>
        <span>{isPlaying ? "Playing 4D Forecast" : "Paused"}</span>
      </div>
    </div>
  );
}
