import React from 'react';

export const OFFICIAL_BRAND_LOGO_URL =
  'https://res.cloudinary.com/utefkiln/image/upload/v1790793157/ChatGPT_Image_30_%D8%B3%D8%A8%D8%AA%D9%85%D8%A8%D8%B1_2026_09_30_19_%D9%85_ni3ugn.png';

interface GameLogoBannerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const GameLogoBanner: React.FC<GameLogoBannerProps> = ({
  size = 'md',
  className = '',
}) => {
  // Proportional responsive sizing maintaining 1672:941 aspect ratio without any distortion
  const sizeClasses =
    size === 'sm'
      ? 'max-w-[150px]'
      : size === 'lg'
      ? 'max-w-[320px] sm:max-w-[360px]'
      : 'max-w-[240px] sm:max-w-[280px]';

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      {/* Subtle ambient glow behind logo */}
      <div className="absolute inset-0 bg-blue-500/15 blur-2xl rounded-full scale-90 pointer-events-none" />

      {/* Official Brand Logo Asset */}
      <img
        src={OFFICIAL_BRAND_LOGO_URL}
        alt="إيه اللي معايا؟ | What Do I Have?"
        className={`w-full ${sizeClasses} h-auto object-contain mx-auto drop-shadow-xl relative z-10 transition-transform duration-300`}
        loading="eager"
      />
    </div>
  );
};
