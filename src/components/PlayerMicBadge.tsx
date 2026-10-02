import React from 'react';
import { Mic, MicOff } from 'lucide-react';

interface PlayerMicBadgeProps {
  isMuted?: boolean;
  isSpeaking?: boolean;
  isSelf?: boolean;
  size?: 'sm' | 'md';
}

export const PlayerMicBadge: React.FC<PlayerMicBadgeProps> = ({
  isMuted = true,
  isSpeaking = false,
  isSelf = false,
  size = 'sm',
}) => {
  const isMicOn = !isMuted;

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const containerPadding = size === 'sm' ? 'p-1' : 'p-1.5';

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full transition-all ${containerPadding} ${
        isMicOn
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
          : 'bg-slate-800 text-slate-500 border border-slate-700'
      }`}
      title={isMicOn ? (isSpeaking ? 'يتكلم الآن 🎙️' : 'المايك مفتوح 🎙️') : 'المايك مقفول 🔇'}
    >
      {/* Subtle speaking ring indicator */}
      {isMicOn && isSpeaking && (
        <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-75 pointer-events-none" />
      )}

      {isMicOn ? (
        <Mic className={`${iconSize} ${isSpeaking ? 'text-emerald-300' : 'text-emerald-400'}`} />
      ) : (
        <MicOff className={iconSize} />
      )}
    </div>
  );
};
