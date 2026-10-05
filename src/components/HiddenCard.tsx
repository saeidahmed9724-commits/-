import React from 'react';

interface HiddenCardProps {
  /** Short text read by screen readers (the picture itself is decorative art). */
  label: string;
  /** Highlights the card while it is its owner's turn. */
  active?: boolean;
  className?: string;
}

/** The face-down "secret picture" card shown inside the game (public/hidden-card.webp). */
export const HiddenCard: React.FC<HiddenCardProps> = ({ label, active = false, className = '' }) => (
  <div
    role="img"
    aria-label={label}
    className={`relative w-full aspect-[2/3] rounded-[22px] overflow-hidden select-none transition-all duration-300 ${
      active
        ? 'ring-4 ring-amber-300/80 shadow-[0_0_30px_rgba(251,191,36,0.45)] scale-[1.02]'
        : 'shadow-[0_0_22px_rgba(59,100,246,0.35)]'
    } ${className}`}
  >
    <img
      src="/hidden-card.webp"
      alt=""
      draggable={false}
      loading="eager"
      decoding="async"
      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
    />
  </div>
);
