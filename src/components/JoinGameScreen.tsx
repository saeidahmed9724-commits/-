import React, { useState } from 'react';
import { KeyRound, ArrowRight, ArrowLeft, Clipboard, AlertCircle, Sparkles, User } from 'lucide-react';
import { sound } from '../utils/audio';

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
        // Extract 5-6 alphanumeric code
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

  return (
    <div className="w-full max-w-md mx-auto py-2 sm:py-4 px-4 animate-scale-up space-y-3.5 pb-4">
      {/* Top Bar: Back & Logo */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onBack();
          }}
          className="inline-flex items-center gap-1.5 text-xs font-black text-slate-600 hover:text-[#171717] bg-white px-3 py-1.5 rounded-full border border-[#E8E4DA] cursor-pointer shadow-2xs active:scale-95"
        >
          <ArrowLeft className={`w-3.5 h-3.5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
          <span>{lang === 'ar' ? 'رجوع' : 'Back'}</span>
        </button>

        <div className="flex items-center gap-1 text-xs font-black text-[#6C5CE7]">
          <span>🎮</span>
          <span>{lang === 'ar' ? 'مين في إيدي؟' : "Who's In My Hand?"}</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E8E4DA] game-card-shadow-lg space-y-5">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl bg-[#6C5CE7]/10 text-[#6C5CE7] flex items-center justify-center mx-auto mb-1">
            <KeyRound className="w-6 h-6" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[#171717] tracking-tight">
            {lang === 'ar' ? 'انضم إلى لعبة' : 'Join a Game'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-bold max-w-xs mx-auto">
            {lang === 'ar'
              ? 'أدخل كود الغرفة الذي أرسله لك صديقك'
              : 'Enter the room code shared by your friend'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              {lang === 'ar' ? 'اسمك' : 'Your Name'}
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={lang === 'ar' ? 'اكتب اسمك هنا...' : 'Enter your name...'}
                className="w-full bg-[#FAF8F5] border border-[#E8E4DA] focus:border-[#6C5CE7] rounded-2xl px-4 py-3 text-sm font-black text-[#171717] focus:outline-none transition-colors"
              />
              <User className="w-4 h-4 text-slate-400 absolute end-3.5 top-3.5" />
            </div>
          </div>

          {/* Big Monospace Room Code Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-black text-[#171717] uppercase tracking-wider">
                {lang === 'ar' ? 'كود الغرفة' : 'Room Code'}
              </label>

              {/* Paste Button */}
              <button
                type="button"
                onClick={handlePasteCode}
                className="inline-flex items-center gap-1 text-[11px] font-black text-[#6C5CE7] hover:text-[#5b4bc4] cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'لصق الكود 📋' : 'Paste Code 📋'}</span>
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                autoFocus
                required
                value={code}
                onChange={handleCodeChange}
                placeholder="6G13Z"
                maxLength={6}
                className="w-full h-16 bg-[#FAF8F5] border-2 border-[#171717] focus:border-[#6C5CE7] rounded-2xl px-4 text-3xl font-black font-mono tracking-widest text-center text-[#171717] uppercase focus:outline-none transition-all shadow-inner"
              />
            </div>
            <p className="text-[11px] text-slate-400 font-bold mt-1 text-center">
              {lang === 'ar' ? 'الكود يتكون من 5 أو 6 أحرف وأرقام' : 'Code consists of 5 or 6 characters'}
            </p>
          </div>

          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border-2 border-rose-300 text-rose-700 text-xs font-black rounded-xl flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Primary Action Button (Solid Purple, Large Touch Target) */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="w-full h-14 bg-[#6C5CE7] hover:bg-[#5b4bc4] disabled:opacity-40 text-white font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-[#6C5CE7]/25 transition-all cursor-pointer active:scale-98"
            >
              <span>
                {isLoading
                  ? lang === 'ar'
                    ? 'جارٍ الاتصال بالغرفة...'
                    : 'Connecting...'
                  : lang === 'ar'
                  ? 'انضم إلى اللعبة ←'
                  : 'Join the Game →'}
              </span>
              {!isLoading && <ArrowRight className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />}
            </button>
          </div>

          {/* Helper Link: ليس لديك كود؟ إنشاء لعبة جديدة */}
          <div className="text-center pt-2 border-t border-[#E8E4DA]">
            <p className="text-xs text-slate-500 font-bold">
              {lang === 'ar' ? 'ليس لديك كود؟' : "Don't have a code?"}{' '}
              <button
                type="button"
                onClick={() => {
                  sound.playCardFlip();
                  onCreateNewGame();
                }}
                className="text-[#6C5CE7] hover:underline font-black cursor-pointer inline-flex items-center gap-1"
              >
                <span>{lang === 'ar' ? 'إنشاء لعبة جديدة' : 'Create new game'}</span>
                <Sparkles className="w-3 h-3 text-[#FFD166]" />
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
