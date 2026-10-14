'use client';

import React, { useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { RightSidebar } from '../../components/RightSidebar';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import {
  ChatCircleDots,
  PaperPlaneTilt,
  Play,
  Pause,
  Disc,
  Fire,
  Heart,
  ThumbsDown,
  ArrowSquareOut,
} from '@phosphor-icons/react';

interface ChatMessage {
  id: string;
  sender: 'me' | 'friend';
  text: string;
  time: string;
  track?: {
    id: string;
    title: string;
    artist: string;
    coverUrl: string;
    year: number;
    previewUrl: string;
    spotifyUrl: string;
  };
  reaction?: string;
}

const CONVERSATION_MOCK: ChatMessage[] = [
  {
    id: 'm1',
    sender: 'friend',
    text: 'Ascolta questa traccia! La linea di chitarra arpeggiata è una delle cose migliori mai scritte da Thom Yorke.',
    time: '18:42',
    track: {
      id: 'trk_weird_fishes',
      title: 'Weird Fishes/Arpeggi',
      artist: 'Radiohead',
      coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&h=200&fit=crop',
      year: 2007,
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
      spotifyUrl: 'https://open.spotify.com',
    },
    reaction: '🔥',
  },
  {
    id: 'm2',
    sender: 'me',
    text: 'Capolavoro assoluto! A metà brano quando entra la seconda chitarra è da pelle d’oca.',
    time: '18:45',
  },
  {
    id: 'm3',
    sender: 'friend',
    text: 'Sì! E poi riascolta anche Get Lucky di Daft Punk, il basso analogico registrato dal vivo è incredibile.',
    time: '18:50',
    track: {
      id: 'trk_get_lucky',
      title: 'Get Lucky',
      artist: 'Daft Punk',
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop',
      year: 2013,
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
      spotifyUrl: 'https://open.spotify.com',
    },
    reaction: '❤️',
  },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(CONVERSATION_MOCK);
  const [inputText, setInputText] = useState('');
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: `m_${Date.now()}`,
      sender: 'me',
      text: inputText,
      time: 'Ora',
    };

    setMessages([...messages, newMsg]);
    setInputText('');
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl justify-center">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar />

      {/* 2. Center Column: Chat Messages */}
      <main className="w-full max-w-2xl flex-1 border-r border-om-border min-h-screen flex flex-col justify-between">
        {/* Chat Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-om-border bg-om-bg/85 backdrop-blur-md px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop"
                alt="Elena Rossi"
                className="h-10 w-10 rounded-full object-cover border border-om-border"
              />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#1DB954] border-2 border-om-bg" />
            </div>

            <div>
              <h2 className="font-sans font-bold text-sm text-om-text">Elena Rossi</h2>
              <p className="text-[11px] font-mono text-[#1DB954]">In ascolto ora su Spotify</p>
            </div>
          </div>

          <span className="text-xs font-mono text-om-secondary border border-om-border bg-om-card px-2.5 py-1 rounded-full">
            ISRC Audio Resolver Attivo
          </span>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 p-4 sm:p-6 space-y-5 overflow-y-auto">
          {messages.map((msg) => {
            const isMe = msg.sender === 'me';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 space-y-3 ${
                    isMe
                      ? 'bg-om-amber text-om-bg rounded-br-none shadow-glow font-medium'
                      : 'bg-om-card border border-om-border text-om-text rounded-bl-none'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.text}</p>

                  {/* Shared Track Card with 30s Audio Preview */}
                  {msg.track && (
                    <div className="rounded-xl border border-om-border/60 bg-om-bg/90 p-3 space-y-2 text-om-text">
                      <div className="flex items-center gap-3">
                        <img
                          src={msg.track.coverUrl}
                          alt={msg.track.title}
                          className="h-12 w-12 rounded-lg object-cover border border-om-border flex-shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <h4 className="font-editorial text-sm font-bold truncate">
                            {msg.track.title}
                          </h4>
                          <p className="text-xs text-om-secondary truncate">
                            {msg.track.artist} • {msg.track.year}
                          </p>
                        </div>

                        <button
                          onClick={() =>
                            msg.track &&
                            playTrack({
                              id: msg.track.id,
                              title: msg.track.title,
                              artist: msg.track.artist,
                              coverUrl: msg.track.coverUrl,
                              previewUrl: msg.track.previewUrl,
                            })
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-om-amber text-om-bg shadow-sm hover:scale-105 active:scale-95 transition-transform flex-shrink-0"
                          aria-label="Ascolta anteprima"
                        >
                          {currentTrack?.id === msg.track.id && isPlaying ? (
                            <Pause weight="fill" className="h-4 w-4" />
                          ) : (
                            <Play weight="fill" className="h-4 w-4 ml-0.5" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-om-muted pt-1 border-t border-om-border/40">
                        <span>Anteprima 30s ISRC</span>
                        <a
                          href={msg.track.spotifyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#1DB954] hover:underline flex items-center gap-1"
                        >
                          <span>Apri in Spotify</span>
                          <ArrowSquareOut size={12} />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Timestamp & Reaction badge */}
                <div className="flex items-center gap-2 mt-1 px-1">
                  <span className="text-[10px] font-mono text-om-secondary">{msg.time}</span>
                  {msg.reaction && (
                    <span className="text-xs bg-om-interactive px-1.5 py-0.5 rounded-full border border-om-border">
                      {msg.reaction}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="border-t border-om-border bg-om-card/90 p-3 sm:p-4 flex items-center gap-3"
        >
          <input
            type="text"
            placeholder="Scrivi un consiglio musicale..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 rounded-xl border border-om-border bg-om-bg px-4 py-2.5 text-xs text-om-text placeholder-om-secondary focus:border-om-amber focus:outline-none font-sans"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-om-amber hover:bg-om-amber/90 text-om-bg transition-transform hover:scale-105 disabled:opacity-40"
          >
            <PaperPlaneTilt weight="bold" className="h-4 w-4" />
          </button>
        </form>
      </main>

      {/* 3. Right Sidebar */}
      <RightSidebar />
    </div>
  );
}
