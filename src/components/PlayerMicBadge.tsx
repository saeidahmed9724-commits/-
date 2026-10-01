import React from 'react';
import { Mic, MicOff } from 'lucide-react';

interface PlayerMicBadgeProps {
  isMuted: boolean;
  isSpeaking?: boolean;
  playerName?: string;
  onToggle?: () => void;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  lang?: 'ar' | 'en';
  className?: string;
}

export const PlayerMicBadge: React.FC<PlayerMicBadgeProps> = ({
  isMuted,
  isSpeaking = false,
  playerName,
  onToggle,
  size = 'sm',
  showLabel = false,
  lang = 'ar',
  className = '',
}) => {
  const isClickable = Boolean(onToggle);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-xs',
  }[size];

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  }[size];

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        disabled={!isClickable}
        onClick={onToggle}
        title={
          playerName
            ? `${playerName}: ${isMuted ? (lang === 'ar' ? 'المايك مقفول' : 'Mic Muted') : (lang === 'ar' ? 'المايك شغال' : 'Mic Active')}`
            : isMuted
            ? (lang === 'ar' ? 'المايك مقفول (اضغط للتشغيل)' : 'Mic Muted (Tap to unmute)')
            : (lang === 'ar' ? 'المايك شغال (اضغط للقفل)' : 'Mic Active (Tap to mute)')
        }
        className={`${sizeClasses} rounded-xl flex items-center justify-center transition-all relative select-none ${
          isClickable ? 'cursor-pointer active:scale-95' : 'cursor-default'
        } ${
          isMuted
            ? 'bg-slate-800/80 text-slate-400 border border-slate-700/80 hover:bg-slate-800'
            : isSpeaking
            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/60 ring-2 ring-emerald-500/30'
            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
        }`}
      >
        {isMuted ? (
          <MicOff className={iconSizes} />
        ) : (
          <>
            <Mic className={iconSizes} />
            {/* Subtle speaking activity dots/ring - non-neon, clean */}
            {isSpeaking && (
              <span className="absolute -top-1 -end-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
            )}
          </>
        )}
      </button>

      {showLabel && (
        <span
          className={`text-[10px] font-bold ${
            isMuted ? 'text-slate-400' : isSpeaking ? 'text-emerald-300' : 'text-emerald-400'
          }`}
        >
          {isMuted
            ? (lang === 'ar' ? 'مكتوم' : 'Muted')
            : isSpeaking
            ? (lang === 'ar' ? 'يتحدث...' : 'Speaking...')
            : (lang === 'ar' ? 'شغال' : 'On')}
        </span>
      )}
    </div>
  );
};
