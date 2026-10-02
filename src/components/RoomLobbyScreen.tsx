import React, { useState, useEffect } from 'react';
import { Copy, Check, ArrowLeft, Share2, Wifi } from 'lucide-react';
import { CategoryDefinition } from '../types/game';
import { sound } from '../utils/audio';
import { onlineService, OnlineRoomData } from '../services/onlineGame';

interface RoomLobbyScreenProps {
  roomCode: string;
  isHost: boolean;
  playerName: string;
  category: CategoryDefinition;
  targetScore: number;
  onStartSecretSelection: () => void;
  onBack: () => void;
  lang: 'ar' | 'en';
}

export const RoomLobbyScreen: React.FC<RoomLobbyScreenProps> = ({
  roomCode,
  isHost,
  playerName,
  category,
  onStartSecretSelection,
  onBack,
  lang,
}) => {
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [roomData, setRoomData] = useState<OnlineRoomData | null>(null);

  useEffect(() => {
    const unsubscribe = onlineService.subscribe((event) => {
       if (event.type === 'ROOM_UPDATE' && event.room) {
        setRoomData(event.room);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const shareUrl = `${window.location.origin}/?room=${roomCode}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      sound.playYesSound();
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      sound.playYesSound();
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const hasOpponent = Boolean(roomData?.guest?.name);
  // The 2-player server sends host/guest (not players[]): count who is actually in the room.
  const joinedCount = roomData?.players ? roomData.players.length : roomData?.guest?.name ? 2 : 1;

  return (
    <div className="w-full max-w-md mx-auto py-2 sm:py-4 px-4 animate-scale-up text-center space-y-3.5 pb-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onBack();
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700 cursor-pointer active:scale-95 transition-colors"
        >
          <ArrowLeft className={`w-3.5 h-3.5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
          <span>{lang === 'ar' ? 'رجوع' : 'Back'}</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
          <span>🎮</span>
          <span>{lang === 'ar' ? 'إيه اللي معايا؟' : 'What Do I Have?'}</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="game-card-surface p-5 sm:p-6 border border-slate-700/60 shadow-2xl space-y-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            {lang === 'ar' ? 'شارك كود الغرفة مع خصمك' : 'Share Room Code'}
          </h2>
          <p className="text-xs text-slate-400 font-bold mt-1">
            {lang === 'ar' ? 'لينضم إليك ويبدأ اللعب' : 'so they can join your match'}
          </p>
        </div>

        {/* Big Code Container */}
        <div className="bg-[#0F172A] rounded-2xl p-4 border border-slate-700/80 space-y-3 shadow-inner">
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-black text-amber-400 font-mono tracking-widest select-all">
              {roomCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              title="Copy"
              className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl border border-slate-700 cursor-pointer"
            >
              {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex-1 py-2.5 px-3 btn-premium-surface text-slate-300 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Copy className="w-3.5 h-3.5 text-blue-400" />
              <span>{copiedCode ? (lang === 'ar' ? 'تم النسخ!' : 'Copied!') : (lang === 'ar' ? 'نسخ الكود' : 'Copy Code')}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 py-2.5 px-3 btn-premium-surface text-slate-300 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5 text-purple-400" />
              <span>{copiedLink ? (lang === 'ar' ? 'تم النسخ!' : 'Copied!') : (lang === 'ar' ? 'مشاركة الرابط' : 'Share Link')}</span>
            </button>
          </div>
        </div>

        {/* Player Cards (2, 3, or 4 players) */}
        <div className="space-y-2 text-start">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-slate-300">
              {lang === 'ar' ? 'اللاعبون في الغرفة' : 'Players in Room'}
            </span>
            <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
              {roomData?.players ? roomData.players.length : 1}/{roomData?.maxPlayers || 2} {lang === 'ar' ? 'لاعبين' : 'Players'}
            </span>
          </div>

          <div className={`grid ${roomData?.maxPlayers && roomData.maxPlayers > 2 ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-2.5'}`}>
            {roomData?.players && roomData.players.length > 0 ? (
              roomData.players.map((p, idx) => {
                const colors = [
                  'border-blue-500/40 bg-blue-500/20 text-blue-300',
                  'border-purple-500/40 bg-purple-500/20 text-purple-300',
                  'border-amber-500/40 bg-amber-500/20 text-amber-300',
                  'border-emerald-500/40 bg-emerald-500/20 text-emerald-300',
                ];
                const badgeColor = colors[idx % colors.length];

                return (
                  <div
                    key={p.id || idx}
                    className="bg-[#0F172A] border border-slate-700/80 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs border ${badgeColor}`}>
                        {idx === 0 ? '👑' : `👤`}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white truncate max-w-[120px] flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {p.isHost && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-amber-400/20 text-amber-300 rounded font-bold">
                              Host
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>{lang === 'ar' ? 'متصل' : 'Connected'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        p.isMuted
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                      }`}>
                        {p.isMuted ? (lang === 'ar' ? 'مايك مقفول 🔇' : 'Muted 🔇') : (lang === 'ar' ? 'مايك شغال 🎙️' : 'Live Mic 🎙️')}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              // Fallback 2-player lobby view
              <>
                <div className="bg-[#0F172A] border border-blue-500/30 rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      👤
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white truncate max-w-[80px]">
                        {roomData?.host?.name || playerName}
                      </div>
                      <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{lang === 'ar' ? 'مستعد' : 'Ready'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0F172A] border border-purple-500/30 rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                      👤
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white truncate max-w-[80px]">
                        {roomData?.guest?.name || (lang === 'ar' ? 'في الانتظار...' : 'Waiting...')}
                      </div>
                      <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${hasOpponent ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                        <span>{hasOpponent ? (lang === 'ar' ? 'مستعد' : 'Ready') : (lang === 'ar' ? 'في الانتظار...' : 'Waiting...')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Waiting placeholders for unfilled slots in 3-4 player modes */}
            {roomData?.maxPlayers && roomData.players && roomData.players.length < roomData.maxPlayers && (
              Array.from({ length: roomData.maxPlayers - roomData.players.length }).map((_, slotIdx) => (
                <div
                  key={`empty-${slotIdx}`}
                  className="bg-[#0F172A]/50 border-2 border-dashed border-slate-700/60 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between text-slate-500 animate-pulse"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-500 flex items-center justify-center font-bold text-xs">
                      +
                    </div>
                    <span className="text-xs font-bold text-slate-400">
                      {lang === 'ar' ? `في انتظار انضمام لاعب ${(roomData.players?.length || 1) + slotIdx + 1}...` : `Waiting for player...`}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">
                    {lang === 'ar' ? 'يحتاج كود الغرفة' : 'Needs Code'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Auto-start notification box */}
        <div className="border border-slate-700/80 bg-[#0F172A] rounded-2xl p-3 text-xs text-slate-400 font-medium flex items-center justify-center gap-2">
          <Wifi className="w-4 h-4 text-blue-400 animate-pulse" />
          <span>
            {roomData?.maxPlayers && roomData.maxPlayers > 2
              ? (lang === 'ar' ? 'كل لاعب يدخل نفس الكود من جهازه الخاص 📱' : 'All players join using room code from their devices')
              : (lang === 'ar' ? 'سيبدأ اللعب تلقائياً عند انضمام الخصم' : 'Game starts when opponent connects')}
          </span>
        </div>

        {/* Start button for Host */}
        {isHost && (
          <button
            type="button"
            disabled={joinedCount < 2}
            onClick={() => {
              sound.playTurnChime();
              onlineService.startChoosing();
            }}
            className="w-full h-14 btn-premium-gold disabled:opacity-40 text-slate-900 font-black rounded-2xl text-base shadow-lg cursor-pointer disabled:cursor-not-allowed transition-all active:scale-98"
          >
            {lang === 'ar' ? 'بدء اختيار الصور السرية ←' : 'Start Choosing Pictures →'}
          </button>
        )}
      </div>
    </div>
  );
};
