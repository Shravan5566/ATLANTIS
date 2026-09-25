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
    <div className="space-y-2.5 p-3.5 rounded-xl ocean-glass-subtle">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
          <Calendar className="w-3.5 h-3.5 text-sky-400" />
          <span>Observation Timestep</span>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-400/25 text-sky-300 font-mono font-bold text-xs shadow-sm">
          {currentTimeStr}
        </div>
      </div>

      {/* Play Controls & Slider */}
      <div className="flex items-center gap-2 pt-1">
        <button
          id="btn-time-play"
          onClick={() => setIsPlaying(!isPlaying)}
          aria-label={isPlaying ? "Pause Animation" : "Play Animation"}
          className={`p-2 rounded-lg transition-all border ${
            isPlaying
              ? "bg-amber-500/15 border-amber-400/40 text-amber-300 shadow-sm"
              : "bg-sky-500/15 hover:bg-sky-500/25 border-sky-400/30 text-sky-300 shadow-sm hover:border-sky-400/50"
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
        </button>

        <button
          id="btn-time-prev"
          onClick={handlePrev}
          title="Previous Step"
          aria-label="Previous Step"
          className="p-1.5 rounded-lg ocean-glass-interactive text-slate-300 hover:text-white"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        <input
          id="slider-time"
          aria-label="Observation Timestep"
          type="range"
          min={0}
          max={Math.max(0, totalSteps - 1)}
          step={1}
          value={timeIndex}
          onChange={(e) => {
            setIsPlaying(false);
            onTimeChange(parseInt(e.target.value, 10));
          }}
          className="flex-1 h-1.5 bg-slate-800/90 rounded-lg appearance-none cursor-pointer accent-sky-400"
        />

        <button
          id="btn-time-next"
          onClick={handleNext}
          title="Next Step"
          aria-label="Next Step"
          className="p-1.5 rounded-lg ocean-glass-interactive text-slate-300 hover:text-white"
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
