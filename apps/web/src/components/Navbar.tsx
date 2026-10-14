'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Disc, UsersThree, Newspaper, VideoCamera, Sparkle, List, X, Waveform } from '@phosphor-icons/react';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-om-border bg-om-bg/90 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-om-card border border-om-border shadow-analog group-hover:border-om-amber transition-colors">
            <Disc weight="duotone" className="h-6 w-6 text-om-amber animate-[spin_10s_linear_infinite]" />
            <div className="absolute h-2 w-2 rounded-full bg-om-bg" />
          </div>
          <div>
            <span className="font-editorial text-xl font-bold tracking-tight text-om-text group-hover:text-om-amber transition-colors">
              OpenMusic
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-mono uppercase tracking-wider text-om-secondary border border-om-border px-1.5 py-0.5 rounded">
              v0.5 Open Beta
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          <Link
            href="/#releases"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-om-secondary hover:text-om-text hover:bg-om-card transition-colors"
          >
            <Disc weight="regular" className="h-4 w-4 text-om-amber" />
            <span>Releases</span>
          </Link>

          <Link
            href="/critics"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-om-secondary hover:text-om-text hover:bg-om-card transition-colors"
          >
            <Newspaper weight="regular" className="h-4 w-4 text-om-amber" />
            <span>Critic Score</span>
          </Link>

          <Link
            href="/videos"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-om-secondary hover:text-om-text hover:bg-om-card transition-colors"
          >
            <VideoCamera weight="regular" className="h-4 w-4 text-om-amber" />
            <span>Video Saggi</span>
          </Link>

          <Link
            href="/#roulette"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-om-secondary hover:text-om-text hover:bg-om-card transition-colors"
          >
            <Sparkle weight="regular" className="h-4 w-4 text-om-amber" />
            <span>Roulette</span>
          </Link>
        </nav>

        {/* Action Button & Live Status */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-om-card/80 border border-om-border px-3 py-1.5 text-xs text-om-secondary font-mono">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-om-amber opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-om-amber"></span>
            </span>
            <span>4 amici in ascolto</span>
          </div>

          <Link
            href="/auth"
            className="flex items-center gap-2 rounded-lg bg-om-amber hover:bg-om-amber/90 text-om-bg font-sans text-xs font-semibold px-3.5 py-2 transition-all shadow-glow hover:scale-[1.02]"
          >
            <Waveform weight="bold" className="h-4 w-4" />
            <span>Accedi / Registrati</span>
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-om-secondary hover:text-om-text rounded-md focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-om-border bg-om-card px-4 pt-2 pb-4 space-y-1">
          <Link
            href="/#releases"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-om-text hover:bg-om-interactive"
          >
            <Disc className="h-5 w-5 text-om-amber" /> Releases
          </Link>
          <Link
            href="/critics"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-om-text hover:bg-om-interactive"
          >
            <Newspaper className="h-5 w-5 text-om-amber" /> Critic Score & Accrediti
          </Link>
          <Link
            href="/videos"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-om-text hover:bg-om-interactive"
          >
            <VideoCamera className="h-5 w-5 text-om-amber" /> Video Saggi Musicali
          </Link>
          <Link
            href="/#roulette"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-om-text hover:bg-om-interactive"
          >
            <Sparkle className="h-5 w-5 text-om-amber" /> Roulette dei Generi
          </Link>
        </div>
      )}
    </header>
  );
};
