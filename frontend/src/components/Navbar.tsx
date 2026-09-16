"use client";

import React from "react";
import Image from "next/image";
import { Compass, Waves, Activity } from "lucide-react";

interface NavbarProps {
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export default function Navbar({ onToggleSidebar, sidebarOpen }: NavbarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 ocean-glass border-b border-cyan-500/20 px-4 flex items-center justify-between select-none">
      {/* Left: Official PNG Logo and Wordmark separately */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
          className="md:hidden p-2 rounded-lg bg-cyan-950/60 text-cyan-400 hover:bg-cyan-900/80 border border-cyan-500/30 transition-all"
        >
          <Waves className="w-5 h-5" />
        </button>

        <div className="flex items-center pl-1">
          {/* Official Wordmark PNG Only */}
          <div className="relative flex items-center">
            <Image
              src="/atlantis-wordmark.png"
              alt="ATLANTIS"
              width={260}
              height={22}
              className="h-5 sm:h-6 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] hover:brightness-110 transition-all"
              priority
            />
          </div>
        </div>
      </div>

      {/* Center: Geospatial Coordinates & Scope */}
      <div className="hidden lg:flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2 px-3.5 py-1 rounded-full ocean-glass-subtle text-slate-300">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            <strong className="text-cyan-300">EEZ Scope:</strong> 6°N–25°N, 68°E–90°E (Arabian Sea & Bay of Bengal)
          </span>
        </div>
      </div>

      {/* Right: Operational Status Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg ocean-glass-subtle border border-emerald-500/30">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium text-emerald-300 hidden sm:inline">
            Live INCOIS & Argo GDAC
          </span>
        </div>

        {/* EEZ attribution — required by Flanders Marine Institute / VLIZ license */}
        <div className="hidden lg:flex items-center text-[10px] text-slate-500 font-mono">
          EEZ ©{" "}
          <a
            href="https://www.marineregions.org/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-slate-400 hover:text-slate-300 underline underline-offset-2 ml-1"
          >
            MarineRegions.org / VLIZ
          </a>
        </div>

        <a
          href="/docs"
          target="_blank"
          rel="noreferrer"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-500/30 transition-all hover:shadow-md hover:shadow-cyan-500/20"
        >
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>API Docs</span>
        </a>
      </div>
    </header>
  );
}
