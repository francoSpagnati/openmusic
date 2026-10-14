'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  Compass,
  Bell,
  ChatCircleDots,
  Sparkle,
  Newspaper,
  User,
  PlusCircle,
  Disc,
  EyeSlash,
  Eye,
  Waveform,
} from '@phosphor-icons/react';

interface SidebarProps {
  onOpenCreatePost?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenCreatePost }) => {
  const pathname = usePathname();
  const [ghostMode, setGhostMode] = useState(false);

  const navItems = [
    { label: 'Home Feed', href: '/', icon: House },
    { label: 'Esplora', href: '/#explore', icon: Compass },
    { label: 'Notifiche', href: '/#notifications', icon: Bell, badge: 3 },
    { label: 'Chat Musicale', href: '/#chat', icon: ChatCircleDots },
    { label: 'Roulette Generi', href: '/#roulette', icon: Sparkle },
    { label: 'Critic Score', href: '/critics', icon: Newspaper },
    { label: 'Video Saggi', href: '/videos', icon: Waveform },
  ];

  return (
    <aside className="sticky top-0 h-screen w-64 flex-shrink-0 flex-col justify-between border-r border-om-border bg-om-bg p-4 hidden lg:flex">
      {/* Top Brand & Nav */}
      <div className="space-y-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 px-2 py-1 group">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-om-card border border-om-border group-hover:border-om-amber transition-colors shadow-analog">
            <Disc weight="duotone" className="h-7 w-7 text-om-amber animate-[spin_12s_linear_infinite]" />
            <div className="absolute h-2.5 w-2.5 rounded-full bg-om-bg" />
          </div>
          <div className="flex flex-col">
            <span className="font-editorial text-2xl font-bold tracking-tight text-om-text group-hover:text-om-amber transition-colors leading-none">
              OpenMusic
            </span>
            <span className="text-[11px] font-sans text-om-secondary mt-1">
              Social Network Musicale
            </span>
          </div>
        </Link>

        {/* Navigation links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === '/' && pathname === '/');

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-om-card text-om-amber font-semibold border border-om-border'
                    : 'text-om-secondary hover:bg-om-card hover:text-om-text'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon
                    weight={isActive ? 'fill' : 'regular'}
                    className={`h-5 w-5 ${isActive ? 'text-om-amber' : 'text-om-secondary'}`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-om-amber text-[10px] font-mono font-bold text-om-bg tabular-nums">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Create Post Action Button */}
        <button
          onClick={onOpenCreatePost}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-om-amber hover:bg-om-amber/90 text-om-bg font-sans font-semibold py-3 text-sm transition-all shadow-glow hover:scale-[1.02] active:scale-98"
        >
          <PlusCircle weight="bold" className="h-5 w-5" />
          <span>Condividi Ascolto</span>
        </button>
      </div>

      {/* Bottom Profile & Ghost Mode Toggle */}
      <div className="rounded-xl border border-om-border bg-om-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop"
              alt="Profilo utente"
              className="h-9 w-9 rounded-full object-cover border border-om-border"
            />
            <div className="min-w-0">
              <h5 className="font-sans text-sm font-semibold text-om-text truncate">
                Franco Spagnati
              </h5>
              <p className="text-[11px] font-mono text-om-secondary truncate">
                @francospagnati
              </p>
            </div>
          </div>
        </div>

        {/* 1-tap Ghost Mode switch */}
        <button
          onClick={() => setGhostMode(!ghostMode)}
          className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-mono transition-colors ${
            ghostMode
              ? 'bg-om-interactive text-om-muted border border-dashed border-om-border'
              : 'bg-om-bg text-om-secondary hover:text-om-text border border-om-border'
          }`}
          title="Attiva la modalità incognito per non mostrare cosa stai ascoltando agli amici"
        >
          <div className="flex items-center gap-1.5">
            {ghostMode ? <EyeSlash size={14} /> : <Eye size={14} />}
            <span>Ghost Mode</span>
          </div>
          <span
            className={`text-[10px] font-bold ${
              ghostMode ? 'text-om-muted' : 'text-om-fresh'
            }`}
          >
            {ghostMode ? 'ATTIVA' : 'OFF'}
          </span>
        </button>
      </div>
    </aside>
  );
};
