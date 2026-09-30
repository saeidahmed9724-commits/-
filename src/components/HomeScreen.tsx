import React, { useState } from 'react';
import { sound } from '../utils/audio';

export const HOME_BG_IMAGE_URL =
  'https://res.cloudinary.com/utefkiln/image/upload/v1790794176/ChatGPT_Image_30_%D8%B3%D8%A8%D8%AA%D9%85%D8%A8%D8%B1_2026_09_47_15_%D9%85_xzytw2.png';

interface HomeScreenProps {
  onCreateOnlineGame: () => void;
  onJoinRoom: () => void;
  onPlayOffline: () => void;
  onPlayWithAI: () => void;
  onOpenRules: () => void;
  lang: 'ar' | 'en';
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onCreateOnlineGame,
  onJoinRoom,
  onPlayOffline,
  onPlayWithAI,
  onOpenRules,
  lang,
  soundEnabled = true,
  onToggleSound,
}) => {
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  return (
    <div className="w-full flex items-center justify-center min-h-screen py-1 px-1 sm:py-3 sm:px-2 animate-fade-in select-none">
      {/* Container with exact aspect ratio of the 941x1671 image */}
      <div className="w-full max-w-[430px] aspect-[941/1671] relative rounded-3xl sm:rounded-[36px] overflow-hidden shadow-2xl bg-[#070D1E] border border-slate-800/80">
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
          src={HOME_BG_IMAGE_URL}
          alt={lang === 'ar' ? 'إيه اللي معايا؟' : 'What Do I Have?'}
          className={`absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="eager"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
        />

        {/* ========================================================================= */}
        {/* 2. INTERACTIVE CONTROLS & BUTTON OVERLAYS (EXACT COORDINATES)              */}
        {/* ========================================================================= */}

        {/* --- Top Bar: Left Game Title Pill --- */}
        <button
          type="button"
          onClick={() => sound.playCardFlip()}
          title={lang === 'ar' ? 'إيه اللي معايا؟' : 'What Do I Have?'}
          aria-label="Game Info"
          className="absolute z-10 cursor-pointer rounded-full transition-all duration-150 active:scale-95 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-blue-400 outline-none"
          style={{ top: '2.0%', left: '12.0%', width: '24.2%', height: '4.2%' }}
        />

        {/* --- Top Bar: Round 1 Pill Indicator --- */}
        <div
          title={lang === 'ar' ? 'الجولة 1' : 'Round 1'}
          className="absolute z-10 rounded-full cursor-default hover:bg-amber-400/10 transition-colors"
          style={{ top: '2.0%', left: '41.0%', width: '17.2%', height: '4.2%' }}
        />

        {/* --- Top Bar: Help (?) Button --- */}
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onOpenRules();
          }}
          title={lang === 'ar' ? 'طريقة اللعب والمساعدة' : 'Rules & Help'}
          aria-label="Rules and Help"
          className="absolute z-10 cursor-pointer rounded-full transition-all duration-150 active:scale-90 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-purple-400 outline-none"
          style={{ top: '2.0%', left: '65.5%', width: '7.2%', height: '4.2%' }}
        />

        {/* --- Top Bar: Sound Speaker Button --- */}
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
          className="absolute z-10 cursor-pointer rounded-full transition-all duration-150 active:scale-90 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-emerald-400 outline-none flex items-center justify-center"
          style={{ top: '2.0%', left: '74.0%', width: '7.2%', height: '4.2%' }}
        >
          {/* Subtle mute indicator overlay when sound is disabled */}
          {!soundEnabled && (
            <div className="w-4 h-0.5 bg-rose-500 rounded-full rotate-45 shadow-sm pointer-events-none" />
          )}
        </button>

        {/* --- Top Bar: Gear / Settings Button --- */}
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onOpenRules();
          }}
          title={lang === 'ar' ? 'الإعدادات والقواعد' : 'Settings & Rules'}
          aria-label="Settings"
          className="absolute z-10 cursor-pointer rounded-full transition-all duration-150 active:scale-90 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-blue-400 outline-none"
          style={{ top: '2.0%', left: '82.5%', width: '7.2%', height: '4.2%' }}
        />

        {/* --- Interactive Preview Card: Opponent's Burger --- */}
        <button
          type="button"
          onClick={() => sound.playCardFlip()}
          title={lang === 'ar' ? 'صورة خصمك المكشوفة' : "Opponent's Photo"}
          aria-label="Opponent Card Preview"
          className="absolute z-10 cursor-pointer rounded-2xl transition-all duration-150 active:scale-95 hover:bg-white/10 outline-none"
          style={{ top: '43.5%', left: '16.0%', width: '28.0%', height: '18.0%' }}
        />

        {/* --- Interactive Preview Card: Your Hidden Card --- */}
        <button
          type="button"
          onClick={() => sound.playTurnChime()}
          title={lang === 'ar' ? 'صورتك المخفية التي يجب أن تخمنها!' : 'Your Secret Hidden Card'}
          aria-label="Secret Card Preview"
          className="absolute z-10 cursor-pointer rounded-2xl transition-all duration-150 active:scale-95 hover:bg-amber-400/10 outline-none"
          style={{ top: '43.5%', left: '56.0%', width: '28.0%', height: '18.0%' }}
        />

        {/* --- Primary CTA 1: ابدأ اللعبة (Start Game) --- */}
        <button
          type="button"
          onClick={() => {
            sound.playTurnChime();
            onCreateOnlineGame();
          }}
          title={lang === 'ar' ? 'ابدأ اللعبة' : 'Start Game'}
          aria-label={lang === 'ar' ? 'ابدأ اللعبة' : 'Start Game'}
          className="absolute z-10 cursor-pointer rounded-[28px] sm:rounded-[32px] transition-all duration-150 active:scale-[0.98] hover:bg-amber-400/15 active:bg-amber-600/20 focus-visible:ring-4 focus-visible:ring-amber-400/50 outline-none"
          style={{ top: '63.7%', left: '13.4%', width: '73.2%', height: '6.1%' }}
        />

        {/* --- Primary CTA 2: وضع لاعبين (جهاز واحد) (Two Players - 1 Device) --- */}
        <button
          type="button"
          onClick={() => {
            sound.playTurnChime();
            onPlayOffline();
          }}
          title={lang === 'ar' ? 'وضع لاعبين (جهاز واحد)' : 'Pass & Play (1 Device)'}
          aria-label={lang === 'ar' ? 'وضع لاعبين (جهاز واحد)' : 'Pass & Play (1 Device)'}
          className="absolute z-10 cursor-pointer rounded-[28px] sm:rounded-[32px] transition-all duration-150 active:scale-[0.98] hover:bg-purple-400/15 active:bg-purple-700/20 focus-visible:ring-4 focus-visible:ring-purple-400/50 outline-none"
          style={{ top: '70.8%', left: '13.4%', width: '73.2%', height: '6.0%' }}
        />

        {/* --- Secondary CTA 1: ضد الروبوت (Solo vs Robot) --- */}
        <button
          type="button"
          onClick={() => {
            sound.playTurnChime();
            onPlayWithAI();
          }}
          title={lang === 'ar' ? 'ضد الروبوت' : 'Solo vs Bot'}
          aria-label={lang === 'ar' ? 'ضد الروبوت' : 'Solo vs Bot'}
          className="absolute z-10 cursor-pointer rounded-2xl transition-all duration-150 active:scale-[0.96] hover:bg-black/5 active:bg-black/15 focus-visible:ring-4 focus-visible:ring-emerald-400/50 outline-none"
          style={{ top: '78.0%', left: '13.4%', width: '35.6%', height: '5.4%' }}
        />

        {/* --- Secondary CTA 2: انضم بكود (Join with Code) --- */}
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onJoinRoom();
          }}
          title={lang === 'ar' ? 'انضم بكود' : 'Join with Code'}
          aria-label={lang === 'ar' ? 'انضم بكود' : 'Join with Code'}
          className="absolute z-10 cursor-pointer rounded-2xl transition-all duration-150 active:scale-[0.96] hover:bg-black/5 active:bg-black/15 focus-visible:ring-4 focus-visible:ring-blue-400/50 outline-none"
          style={{ top: '78.0%', left: '51.1%', width: '35.5%', height: '5.4%' }}
        />

        {/* --- Footer Nav 1: الإعدادات والقواعد (Settings & Rules) --- */}
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onOpenRules();
          }}
          title={lang === 'ar' ? 'الإعدادات والقواعد' : 'Settings & Rules'}
          aria-label={lang === 'ar' ? 'الإعدادات والقواعد' : 'Settings & Rules'}
          className="absolute z-10 cursor-pointer rounded-2xl transition-all duration-150 active:scale-[0.93] hover:bg-blue-400/15 active:bg-blue-600/25 outline-none"
          style={{ top: '84.6%', left: '16.0%', width: '22.0%', height: '7.6%' }}
        />

        {/* --- Footer Nav 2: غرفة خاصة (Private Room) --- */}
        <button
          type="button"
          onClick={() => {
            sound.playTurnChime();
            onCreateOnlineGame();
          }}
          title={lang === 'ar' ? 'غرفة خاصة' : 'Private Room'}
          aria-label={lang === 'ar' ? 'غرفة خاصة' : 'Private Room'}
          className="absolute z-10 cursor-pointer rounded-2xl transition-all duration-150 active:scale-[0.93] hover:bg-purple-400/15 active:bg-purple-600/25 outline-none"
          style={{ top: '84.6%', left: '42.0%', width: '16.0%', height: '7.6%' }}
        />

        {/* --- Footer Nav 3: طريقة اللعب (How to Play) --- */}
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onOpenRules();
          }}
          title={lang === 'ar' ? 'طريقة اللعب' : 'How to Play'}
          aria-label={lang === 'ar' ? 'طريقة اللعب' : 'How to Play'}
          className="absolute z-10 cursor-pointer rounded-2xl transition-all duration-150 active:scale-[0.93] hover:bg-blue-400/15 active:bg-blue-600/25 outline-none"
          style={{ top: '84.6%', left: '65.0%', width: '22.0%', height: '7.6%' }}
        />
      </div>
    </div>
  );
};


