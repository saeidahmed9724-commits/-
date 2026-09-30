import React, { useState } from 'react';
import { Play, ArrowLeft, Clipboard, AlertCircle, User, KeyRound, Sparkles } from 'lucide-react';
import { sound } from '../utils/audio';
import { GameLogoBanner } from './GameLogoBanner';

interface JoinGameScreenProps {
  initialCode?: string;
  onJoinRoom: (code: string, playerName: string) => Promise<void>;
  onCreateNewGame: () => void;
  onBack: () => void;
  lang: 'ar' | 'en';
}

export const JoinGameScreen: React.FC<JoinGameScreenProps> = ({
  initialCode = '',
  onJoinRoom,
  onCreateNewGame,
  onBack,
  lang,
}) => {
  const [code, setCode] = useState<string>(initialCode.toUpperCase());
  const [playerName, setPlayerName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const cleaned = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        if (cleaned) {
          setCode(cleaned);
          sound.playCardFlip();
        }
      }
    } catch {
      // Fallback
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(val);
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = playerName.trim() || (lang === 'ar' ? 'اللاعب 2' : 'Player 2');

    if (!cleanCode) {
      setErrorMessage(lang === 'ar' ? 'من فضلك أدخل كود الغرفة' : 'Please enter room code');
      return;
    }

    if (cleanCode.length < 4) {
      setErrorMessage(lang === 'ar' ? 'كود الغرفة غير مكتمل' : 'Room code is incomplete');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    sound.playTurnChime();

    try {
      await onJoinRoom(cleanCode, cleanName);
    } catch {
      sound.playWrongBuzzer();
      setErrorMessage(
        lang === 'ar'
          ? 'تعذر العثور على الغرفة أو الاتصال بها. تأكد من صحة الكود.'
          : 'Could not find or connect to room. Please check the code.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Convert code to individual character boxes (5 to 6 slots)
  const codeChars = code.padEnd(5, ' ').slice(0, 6).split('');

  return (
    <div className="w-full max-w-md mx-auto py-2 px-3 animate-scale-up space-y-4 pb-6 select-none">
      {/* Top Bar: Back & Mini Logo */}
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

        <GameLogoBanner size="sm" className="max-w-[100px]" />
      </div>

      {/* Main Elevated Card Surface */}
      <div className="game-card-surface p-6 sm:p-7 space-y-5 border border-slate-700/60">
        {/* Header Icon & Title */}
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto mb-2 shadow-sm">
            <KeyRound className="w-6 h-6" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {lang === 'ar' ? 'انضمام بكود الغرفة' : 'Join with Room Code'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-bold max-w-xs mx-auto">
            {lang === 'ar'
              ? 'أدخل كود الغرفة الذي أرسله لك صديقك'
              : 'Enter the room code shared by your friend'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 px-1">
              {lang === 'ar' ? 'اسمك' : 'Your Name'}
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={lang === 'ar' ? 'اكتب اسمك هنا...' : 'Enter your name...'}
                className="w-full h-12 bg-[#0F172A] border border-slate-700 focus:border-blue-500 rounded-xl ps-4 pe-10 text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none transition-colors"
              />
              <User className="w-4 h-4 text-slate-500 absolute end-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Room Code Section with Separate Letter Tiles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-bold text-slate-300">
                {lang === 'ar' ? 'كود الغرفة' : 'Room Code'}
              </label>

              <button
                type="button"
                onClick={handlePasteCode}
                className="text-[11px] font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'لصق الكود' : 'Paste Code'}</span>
              </button>
            </div>

            {/* Hidden Input Layer for Typing on Mobile */}
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={handleCodeChange}
                maxLength={6}
                autoFocus
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 text-center tracking-widest text-transparent"
              />

              {/* Visual Interactive Squircle Tiles Container */}
              <div className="w-full bg-[#0F172A] border border-slate-700/80 rounded-2xl p-3 flex items-center justify-center gap-2 shadow-inner">
                {codeChars.map((char, idx) => (
                  <div
                    key={idx}
                    className={`w-11 sm:w-13 h-14 rounded-xl flex items-center justify-center font-mono text-2xl font-black transition-all ${
                      char.trim()
                        ? 'bg-[#1E293B] border-2 border-amber-500 text-amber-400 shadow-md scale-102'
                        : 'bg-slate-800/40 border border-slate-700 text-slate-600'
                    }`}
                  >
                    {char.trim() ? char : '·'}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-center font-medium text-slate-500">
              {lang === 'ar'
                ? 'الكود يتكون من 5 أو 6 أحرف وأرقام'
                : 'Room code consists of 5 or 6 characters'}
            </p>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/40 border border-rose-600/50 rounded-xl text-xs font-bold text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Primary CTA Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="w-full h-14 btn-premium-blue rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:scale-98 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white text-white" />
              <span>
                {isLoading
                  ? lang === 'ar'
                    ? 'جاري الاتصال...'
                    : 'Connecting...'
                  : lang === 'ar'
                  ? 'انضم إلى اللعبة'
                  : 'Join Game'}
              </span>
            </button>
          </div>
        </form>

        {/* Footer Link */}
        <div className="pt-2 text-center border-t border-slate-800">
          <button
            type="button"
            onClick={onCreateNewGame}
            className="text-xs font-bold text-slate-400 hover:text-amber-400 flex items-center justify-center gap-1.5 mx-auto cursor-pointer transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {lang === 'ar'
                ? 'ليس لديك كود؟ إنشاء لعبة جديدة'
                : "Don't have a code? Create New Game"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
