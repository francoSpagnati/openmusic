'use client';

import React from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { RightSidebar } from '../../components/RightSidebar';
import {
  Bell,
  Heart,
  ChatCircle,
  Disc,
  UserPlus,
  Waveform,
} from '@phosphor-icons/react';

interface NotificationItem {
  id: string;
  type: 'LIKE' | 'COMMENT' | 'FOLLOW' | 'LISTENED';
  user: {
    name: string;
    handle: string;
    avatar: string;
  };
  timeAgo: string;
  detail: string;
  releaseTitle?: string;
}

const NOTIFICATIONS_DATA: NotificationItem[] = [
  {
    id: 'n1',
    type: 'LIKE',
    user: {
      name: 'Elena Rossi',
      handle: '@elena_rossi',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    },
    timeAgo: '12m fa',
    detail: 'ha apprezzato la tua recensione di In Rainbows',
    releaseTitle: 'Radiohead — In Rainbows',
  },
  {
    id: 'n2',
    type: 'LISTENED',
    user: {
      name: 'Marco Valenti',
      handle: '@marcov',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    },
    timeAgo: '45m fa',
    detail: 'ha ascoltato il brano che gli hai consigliato in chat (Time - Pink Floyd)',
    releaseTitle: 'Pink Floyd — The Dark Side of the Moon',
  },
  {
    id: 'n3',
    type: 'FOLLOW',
    user: {
      name: 'Chiara Moretti',
      handle: '@chiara_vinyl',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    },
    timeAgo: '2h fa',
    detail: 'ha iniziato a seguire i tuoi ascolti e le tue playlist',
  },
  {
    id: 'n4',
    type: 'COMMENT',
    user: {
      name: 'Sofia Bianchi',
      handle: '@sofiab',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    },
    timeAgo: '4h fa',
    detail: 'ha commentato: "Concordo al 100%! La linea di basso di Random Access Memories è poesia pura."',
    releaseTitle: 'Daft Punk — Random Access Memories',
  },
];

export default function NotificationsPage() {
  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'LIKE':
        return <Heart weight="fill" size={18} className="text-red-500" />;
      case 'LISTENED':
        return <Waveform weight="bold" size={18} className="text-om-fresh" />;
      case 'FOLLOW':
        return <UserPlus weight="bold" size={18} className="text-om-amber" />;
      case 'COMMENT':
        return <ChatCircle weight="fill" size={18} className="text-blue-400" />;
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl justify-center">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar />

      {/* 2. Center Column: Notifications */}
      <main className="w-full max-w-2xl flex-1 border-r border-om-border min-h-screen p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-om-border pb-4">
          <div className="flex items-center gap-2">
            <Bell size={22} weight="duotone" className="text-om-amber" />
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-om-text">
              Notifiche
            </h1>
          </div>
          <span className="text-xs font-mono text-om-secondary">Tutte lette</span>
        </div>

        <div className="divide-y divide-om-border rounded-xl border border-om-border bg-om-card overflow-hidden">
          {NOTIFICATIONS_DATA.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 flex items-start gap-4 hover:bg-om-interactive/40 transition-colors"
            >
              <div className="mt-1 flex-shrink-0">{getIcon(item.type)}</div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <img
                    src={item.user.avatar}
                    alt={item.user.name}
                    className="h-7 w-7 rounded-full object-cover border border-om-border"
                  />
                  <span className="font-sans font-bold text-sm text-om-text">
                    {item.user.name}
                  </span>
                  <span className="text-xs font-mono text-om-secondary">
                    {item.user.handle}
                  </span>
                  <span className="text-xs text-om-muted">•</span>
                  <span className="text-xs font-mono text-om-secondary tabular-nums">
                    {item.timeAgo}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-om-text/90 leading-relaxed font-sans">
                  {item.detail}
                </p>

                {item.releaseTitle && (
                  <span className="inline-block text-[11px] font-mono text-om-amber mt-0.5">
                    {item.releaseTitle}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 3. Right Sidebar */}
      <RightSidebar />
    </div>
  );
}
