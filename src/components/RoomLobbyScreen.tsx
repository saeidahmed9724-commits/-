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
        if (event.room.phase === 'CHOOSING') {
          onStartSecretSelection();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onStartSecretSelection]);

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

        {/* Two Player Cards Side by Side */}
        <div className="grid grid-cols-2 gap-2.5 text-start">
          {/* Host (Player 1: Blue) */}
          <div className="bg-[#0F172A] border border-blue-500/30 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                👤
              </div>
              <div>
                <div className="text-xs font-bold text-white truncate max-w-[80px]">
                  {roomData?.host.name || playerName}
                </div>
                <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{lang === 'ar' ? 'مستعد' : 'Ready'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Guest (Player 2: Purple) */}
          <div className="bg-[#0F172A] border border-purple-500/30 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                👤
              </div>
              <div>
                <div className="text-xs font-bold text-white truncate max-w-[80px]">
                  {roomData?.guest?.name || (lang === 'ar' ? 'الخصم' : 'Opponent')}
                </div>
                <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${hasOpponent ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                  <span>{hasOpponent ? (lang === 'ar' ? 'مستعد' : 'Ready') : (lang === 'ar' ? 'في الانتظار...' : 'Waiting...')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Auto-start notification box */}
        <div className="border border-slate-700/80 bg-[#0F172A] rounded-2xl p-3 text-xs text-slate-400 font-medium flex items-center justify-center gap-2">
          <Wifi className="w-4 h-4 text-blue-400 animate-pulse" />
          <span>{lang === 'ar' ? 'سيبدأ اللعب تلقائياً عند انضمام الخصم' : 'Game starts when opponent connects'}</span>
        </div>

        {/* Start button if host and opponent connected */}
        {isHost && (
          <button
            type="button"
            disabled={!hasOpponent}
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
