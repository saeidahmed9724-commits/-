import React from 'react';
import { Globe, Link2, Users, Play, Bot, Sparkles } from 'lucide-react';
import { sound } from '../utils/audio';

interface HomeScreenProps {
  onCreateOnlineGame: () => void;
  onJoinRoom: () => void;
  onPlayOffline: () => void;
  onPlayWithAI: () => void;
  onOpenRules: () => void;
  lang: 'ar' | 'en';
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onCreateOnlineGame,
  onJoinRoom,
  onPlayOffline,
  onPlayWithAI,
  onOpenRules,
  lang,
}) => {
  return (
    <div className="w-full max-w-md mx-auto py-2 sm:py-6 px-4 text-center flex flex-col items-center justify-center animate-fade-in relative">
      {/* Decorative Floating Colorful Confetti Shapes */}
      <div className="absolute top-2 start-4 w-3 h-3 rounded-full bg-[#FFD166] animate-bounce opacity-80" />
      <div className="absolute top-6 end-6 w-3 h-3 rounded-full bg-[#FF5C8A] opacity-70" />
      <div className="absolute top-16 start-8 w-2.5 h-2.5 rounded-full bg-[#6C5CE7] opacity-60" />
      <div className="absolute top-24 end-10 w-3 h-3 rounded-full bg-[#4ED7B0] opacity-80" />

      {/* Hero Title */}
      <div className="relative mb-2">
        <h1 className="text-4xl sm:text-5xl font-black text-[#171717] tracking-tight">
          {lang === 'ar' ? 'مين في إيدي؟' : "Who's In My Hand?"}
        </h1>
      </div>

      {/* Subtitle */}
      <p className="text-sm sm:text-base font-bold text-slate-600 max-w-xs mx-auto mb-5 leading-relaxed">
        {lang === 'ar' ? (
          <>
            شوف صورة خصمك..
            <br />
            وخليّه يوصف لك صورتك من غير ما تشوفها!
          </>
        ) : (
          <>
            See your opponent's picture..
            <br />
            and deduce your own without ever seeing it!
          </>
        )}
      </p>

      {/* Center 2-Hand / 2-Card Graphic Hero Card */}
      <div className="w-full bg-white rounded-3xl p-5 border border-[#E8E4DA] game-card-shadow-lg mb-5 relative group">
        <div className="flex items-center justify-center gap-3">
          {/* Hand 1: Holding Mystery Card */}
          <div className="flex flex-col items-center flex-1">
            <div className="w-full max-w-[130px] aspect-[3/4] rounded-2xl bg-gradient-to-br from-[#1E1B4B] via-[#2E1065] to-[#171717] border-2 border-white text-white flex flex-col items-center justify-center shadow-lg transform -rotate-6 transition-transform">
              <span className="font-mono font-black text-5xl text-[#FFD166] drop-shadow-md">
                ?
              </span>
            </div>
            <div className="mt-2 text-[11px] font-black text-[#6C5CE7] bg-[#6C5CE7]/10 px-2.5 py-0.5 rounded-full whitespace-nowrap">
              {lang === 'ar' ? 'صورتك المخفية' : 'Your Card'}
            </div>
          </div>

          {/* VS Divider in between */}
          <div className="w-8 h-8 rounded-full bg-white border-2 border-[#171717] text-[#171717] font-black text-[11px] flex items-center justify-center shadow-xs shrink-0">
            VS
          </div>

          {/* Hand 2: Holding Visible Picture (Burger) */}
          <div className="flex flex-col items-center flex-1">
            <div className="w-full max-w-[130px] aspect-[3/4] rounded-2xl bg-[#FFF8E7] border-2 border-[#171717] flex flex-col items-center justify-center shadow-lg transform rotate-6 transition-transform p-2">
              <span className="text-4xl sm:text-5xl drop-shadow-md">🍔</span>
              <span className="font-black text-[10px] text-[#171717] uppercase tracking-wider mt-1">
                BURGER
              </span>
            </div>
            <div className="mt-2 text-[11px] font-black text-[#FF5C8A] bg-[#FF5C8A]/10 px-2.5 py-0.5 rounded-full whitespace-nowrap">
              {lang === 'ar' ? 'صورة خصمك' : "Opponent's Card"}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Buttons: Distinct Paths for Online Create vs Join */}
      <div className="w-full space-y-2.5 mb-4">
        {/* 1. إنشاء لعبة أونلاين (Solid Purple) */}
        <button
          type="button"
          onClick={() => {
            sound.playTurnChime();
            onCreateOnlineGame();
          }}
          className="w-full h-14 bg-[#6C5CE7] hover:bg-[#5b4bc4] text-white font-black rounded-2xl text-base flex items-center justify-center gap-2.5 shadow-md shadow-[#6C5CE7]/25 transition-all cursor-pointer active:scale-98"
        >
          <Globe className="w-5 h-5" />
          <span className="text-base sm:text-lg">{lang === 'ar' ? 'إنشاء لعبة أونلاين' : 'Create Online Game'}</span>
        </button>

        {/* 2. الانضمام بكود (White/Mint Card with Link Icon) */}
        <button
          type="button"
          onClick={() => {
            sound.playTurnChime();
            onJoinRoom();
          }}
          className="w-full h-14 bg-white hover:bg-slate-50 text-[#171717] font-black rounded-2xl border-2 border-[#171717] text-base flex items-center justify-center gap-2.5 shadow-xs transition-all cursor-pointer active:scale-98"
        >
          <Link2 className="w-5 h-5 text-[#6C5CE7]" />
          <span className="text-base sm:text-lg">{lang === 'ar' ? 'الانضمام بكود 🔗' : 'Join with Code 🔗'}</span>
        </button>

        {/* 3. اللعب على نفس الجهاز (Solid Pink) */}
        <button
          type="button"
          onClick={() => {
            sound.playTurnChime();
            onPlayOffline();
          }}
          className="w-full h-14 bg-[#FF5C8A] hover:bg-[#eb4b79] text-white font-black rounded-2xl text-base flex items-center justify-center gap-2.5 shadow-md shadow-[#FF5C8A]/25 transition-all cursor-pointer active:scale-98"
        >
          <Users className="w-5 h-5" />
          <span className="text-base sm:text-lg">{lang === 'ar' ? 'اللعب على نفس الجهاز' : 'Play on 1 Device'}</span>
        </button>

        {/* 4. Solo vs AI Practice */}
        <button
          type="button"
          onClick={() => {
            sound.playTurnChime();
            onPlayWithAI();
          }}
          className="w-full h-11 bg-white hover:bg-[#4ED7B0]/10 text-slate-700 font-bold rounded-2xl border border-[#E8E4DA] text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
        >
          <Bot className="w-4 h-4 text-[#4ED7B0]" />
          <span>{lang === 'ar' ? 'تمرين فردي ضد الذكاء الاصطناعي 🤖' : 'Solo vs AI 🤖'}</span>
        </button>
      </div>

      {/* Rules / How to play pill */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onOpenRules();
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-[#171717] font-black rounded-full border border-[#E8E4DA] shadow-xs text-xs cursor-pointer transition-all hover:scale-105 active:scale-95"
        >
          <Play className="w-3 h-3 fill-[#171717] text-[#171717]" />
          <span>{lang === 'ar' ? 'كيف تلعب؟' : 'How to Play?'}</span>
        </button>
      </div>
    </div>
  );
};
