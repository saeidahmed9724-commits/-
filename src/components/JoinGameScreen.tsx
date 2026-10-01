import React, { useState } from 'react';
import { sound } from '../utils/audio';

export const JOIN_GAME_BG_URL =
  'https://res.cloudinary.com/utefkiln/image/upload/v1790795454/ChatGPT_Image_30_%D8%B3%D8%A8%D8%AA%D9%85%D8%A8%D8%B1_2026_09_59_58_%D9%85_jjoqje.png';

interface JoinGameScreenProps {
  initialCode?: string;
  onJoinRoom: (code: string, playerName: string) => Promise<void>;
  onCreateNewGame: () => void;
  onBack: () => void;
  lang: 'ar' | 'en';
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onOpenRules?: () => void;
}

export const JoinGameScreen: React.FC<JoinGameScreenProps> = ({
  initialCode = '',
  onJoinRoom,
  onCreateNewGame,
  onBack,
  lang,
  soundEnabled = true,
  onToggleSound,
  onOpenRules,
}) => {
  const [code, setCode] = useState<string>(initialCode.toUpperCase());
  const [playerName, setPlayerName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

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
      sound.playWrongBuzzer();
      return;
    }

    if (cleanCode.length < 4) {
      setErrorMessage(lang === 'ar' ? 'كود الغرفة غير مكتمل' : 'Room code is incomplete');
      sound.playWrongBuzzer();
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

  // Convert code to individual character slots (6 slots)
  const codeChars = code.padEnd(6, ' ').slice(0, 6).split('');

  return (
    <div className="w-full flex items-center justify-center min-h-screen py-1 px-1 sm:py-3 sm:px-2 animate-fade-in select-none">
      {/* Container with exact aspect ratio of the 899x1748 image */}
      <div className="w-full max-w-[430px] aspect-[899/1748] relative rounded-3xl sm:rounded-[36px] overflow-hidden shadow-2xl bg-[#070D1E] border border-slate-800/80">
        {/* Placeholder / Shimmer while loading */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A] via-[#1E293B] to-[#070D1E] animate-pulse flex items-center justify-center">
            <span className="text-sm font-bold text-slate-400">
              {lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </span>
          </div>
        )}

        {/* 1. Official High-Fidelity Background Image Asset */}
        <img
          src={JOIN_GAME_BG_URL}
          alt={lang === 'ar' ? 'انضمام بكود الغرفة' : 'Join with Room Code'}
          className={`absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="eager"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
        />

        {/* ========================================================================= */}
        {/* 2. TOP BAR CONTROLS                                                       */}
        {/* ========================================================================= */}

        {/* Help (?) Button */}
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onOpenRules?.();
          }}
          title={lang === 'ar' ? 'طريقة اللعب والمساعدة' : 'Rules & Help'}
          aria-label="Rules and Help"
          className="absolute z-10 cursor-pointer rounded-full transition-all duration-150 active:scale-90 hover:bg-white/20 outline-none"
          style={{ top: '1.8%', left: '63.7%', width: '8.2%', height: '4.2%' }}
        />

        {/* Sound Speaker Button */}
        <button
          type="button"
          onClick={() => {
            if (onToggleSound) {
              onToggleSound();
              sound.playTurnChime();
            }
          }}
          title={soundEnabled ? (lang === 'ar' ? 'كتم الصوت' : 'Mute') : (lang === 'ar' ? 'تشغيل الصوت' : 'Unmute')}
          aria-label="Sound Toggle"
          className="absolute z-10 cursor-pointer rounded-full transition-all duration-150 active:scale-90 hover:bg-white/20 outline-none flex items-center justify-center"
          style={{ top: '1.8%', left: '73.7%', width: '8.2%', height: '4.2%' }}
        >
          {!soundEnabled && (
            <div className="w-4 h-0.5 bg-rose-500 rounded-full rotate-45 shadow-sm pointer-events-none" />
          )}
        </button>

        {/* Settings Button */}
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onOpenRules?.();
          }}
          title={lang === 'ar' ? 'الإعدادات والقواعد' : 'Settings & Rules'}
          aria-label="Settings"
          className="absolute z-10 cursor-pointer rounded-full transition-all duration-150 active:scale-90 hover:bg-white/20 outline-none"
          style={{ top: '1.8%', left: '83.7%', width: '8.2%', height: '4.2%' }}
        />

        {/* ========================================================================= */}
        {/* 3. BACK BUTTON (< رجوع)                                                   */}
        {/* ========================================================================= */}
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onBack();
          }}
          title={lang === 'ar' ? 'رجوع' : 'Back'}
          aria-label={lang === 'ar' ? 'رجوع' : 'Back'}
          className="absolute z-10 cursor-pointer rounded-full transition-all duration-150 active:scale-95 hover:bg-white/15 outline-none"
          style={{ top: '7.8%', left: '7.8%', width: '21.2%', height: '3.8%' }}
        />

        {/* ========================================================================= */}
        {/* 4. FORM INTERACTIVE CONTROLS OVERLAYS                                     */}
        {/* ========================================================================= */}
        <form onSubmit={handleSubmit}>
          {/* Name Input Field (اكتب اسمك هنا...) */}
          <div
            className="absolute z-10 flex items-center px-4"
            style={{ top: '45.3%', left: '11.3%', width: '77.4%', height: '5.5%' }}
          >
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={lang === 'ar' ? 'اكتب اسمك هنا...' : 'Enter your name...'}
              className="w-full h-full bg-transparent text-white font-bold text-sm sm:text-base outline-none placeholder:text-slate-500/70 border-none px-2 focus:ring-0"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>

          {/* Paste Code Button (لصق الكود) */}
          <button
            type="button"
            onClick={handlePasteCode}
            title={lang === 'ar' ? 'لصق الكود' : 'Paste Code'}
            aria-label={lang === 'ar' ? 'لصق الكود' : 'Paste Code'}
            className="absolute z-10 cursor-pointer rounded-xl transition-all duration-150 active:scale-95 hover:bg-white/10 outline-none"
            style={{ top: '53.0%', left: '11.4%', width: '24.1%', height: '3.9%' }}
          />

          {/* 6-Slot Code Input Boxes */}
          <div
            className="absolute z-10 flex items-center justify-between cursor-text"
            style={{ top: '59.2%', left: '11.3%', width: '77.4%', height: '7.3%' }}
          >
            {/* Real hidden text input capturing keystrokes */}
            <input
              type="text"
              value={code}
              onChange={handleCodeChange}
              maxLength={6}
              autoFocus
              className="absolute inset-0 w-full h-full opacity-0 cursor-text z-20"
            />

            {/* Individual Slot Characters Rendering Over Image's Slot Boxes */}
            <div className="w-full h-full flex items-center justify-around px-2 pointer-events-none">
              {codeChars.map((char, idx) => (
                <div
                  key={idx}
                  className="flex-1 flex items-center justify-center font-mono font-black text-xl sm:text-2xl text-amber-400 drop-shadow-md select-none"
                >
                  {char.trim() ? char : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Error Message Toast Overlay */}
          {errorMessage && (
            <div
              className="absolute z-20 px-3 py-1.5 bg-rose-950/90 border border-rose-500/80 rounded-xl text-[11px] font-bold text-rose-200 shadow-xl flex items-center justify-center text-center animate-shake"
              style={{ top: '67.8%', left: '11.3%', width: '77.4%' }}
            >
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Main CTA Button: انضم إلى اللعبة */}
          <button
            type="submit"
            disabled={isLoading}
            title={lang === 'ar' ? 'انضم إلى اللعبة' : 'Join Game'}
            aria-label={lang === 'ar' ? 'انضم إلى اللعبة' : 'Join Game'}
            className="absolute z-10 cursor-pointer rounded-[28px] sm:rounded-[32px] transition-all duration-150 active:scale-[0.98] hover:bg-amber-400/20 active:bg-amber-600/30 focus-visible:ring-4 focus-visible:ring-amber-400/50 outline-none flex items-center justify-center"
            style={{ top: '72.9%', left: '11.3%', width: '77.4%', height: '7.5%' }}
          >
            {isLoading && (
              <span className="font-bold text-sm text-slate-900 bg-amber-400/80 px-4 py-1.5 rounded-full shadow-md animate-pulse">
                {lang === 'ar' ? 'جاري الاتصال...' : 'Connecting...'}
              </span>
            )}
          </button>
        </form>

        {/* Footer Link: ليس لديك كود؟ إنشاء لعبة جديدة */}
        <button
          type="button"
          onClick={() => {
            sound.playTurnChime();
            onCreateNewGame();
          }}
          title={lang === 'ar' ? 'إنشاء لعبة جديدة' : 'Create New Game'}
          aria-label={lang === 'ar' ? 'إنشاء لعبة جديدة' : 'Create New Game'}
          className="absolute z-10 cursor-pointer rounded-xl transition-all duration-150 active:scale-95 hover:bg-amber-400/10 outline-none"
          style={{ top: '83.5%', left: '20.0%', width: '60.0%', height: '3.5%' }}
        />
      </div>
    </div>
  );
};

