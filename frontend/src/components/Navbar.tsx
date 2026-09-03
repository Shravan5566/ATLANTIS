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
    <header className="fixed top-0 left-0 right-0 h-16 z-50 ocean-glass border-b border-cyan-500/20 px-4 flex items-center justify-between">
      {/* Left: Brand & Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
          className="md:hidden p-2 rounded-lg bg-cyan-950/60 text-cyan-400 hover:bg-cyan-900/80 border border-cyan-500/30 transition-all"
        >
          <Waves className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-cyan-400/40 shadow-lg shadow-cyan-500/20 bg-slate-950 flex items-center justify-center">
            <Image
              src="/atlantis-logo.png"
              alt="ATLANTIS Logo"
              width={40}
              height={40}
              className="object-contain p-0.5"
              priority
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-white">
                ATLANTIS
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                MoES · INCOIS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block font-medium">
              India EEZ Ocean Visualization Platform
            </p>
          </div>
        </div>
      </div>

      {/* Center: Geospatial Coordinates & Scope */}
      <div className="hidden lg:flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full ocean-glass-subtle text-slate-300">
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

        <a
          href="http://localhost:8000/docs"
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
