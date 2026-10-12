import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ 
  className = '', 
  size = 'md', 
  showText = true 
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const textSizes = {
    sm: 'text-sm tracking-[0.25em]',
    md: 'text-lg tracking-[0.3em]',
    lg: 'text-2xl tracking-[0.35em]',
    xl: 'text-3xl tracking-[0.4em]'
  };

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {/* Monogram Icon */}
      <div className={`relative ${iconSizes[size]} flex items-center justify-center`}>
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          <defs>
            {/* Metallic Silver Gradient */}
            <linearGradient id="silverStem" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8E8E93" />
              <stop offset="35%" stopColor="#C7C7CC" />
              <stop offset="65%" stopColor="#F2F2F7" />
              <stop offset="100%" stopColor="#AEAEB2" />
            </linearGradient>

            <linearGradient id="silverRibbon" x1="10%" y1="0%" x2="90%" y2="100%">
              <stop offset="0%" stopColor="#E5E5EA" />
              <stop offset="40%" stopColor="#FFFFFF" />
              <stop offset="70%" stopColor="#C7C7CC" />
              <stop offset="100%" stopColor="#8E8E93" />
            </linearGradient>

            <linearGradient id="sparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#AEAEB2" />
              <stop offset="50%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#8E8E93" />
            </linearGradient>

            <filter id="softShadow" x="-10%" y="-10%" width="125%" height="125%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* Letter L Stem */}
          <path
            d="M 50 20 
               C 53 20 56 22 56 26 
               L 56 78 
               C 56 82 50 84 46 84 
               L 42 84 
               C 42 84 54 86 64 86 
               L 66 84 
               C 62 84 60 82 60 76 
               L 60 26 
               C 60 22 63 20 66 20 
               Z"
            fill="url(#silverStem)"
            filter="url(#softShadow)"
          />

          {/* Elegant Top Serif on L */}
          <path
            d="M 44 23 
               C 50 24 58 20 62 18
               L 60 24
               C 55 24 50 23 44 23 Z"
            fill="url(#silverRibbon)"
          />

          {/* Flowing infinity ribbon curve wrapping around L */}
          <path
            d="M 24 56 
               C 32 46 44 48 54 57 
               C 64 66 74 76 86 76 
               C 96 76 102 68 100 58 
               C 98 48 88 47 78 55 
               C 68 63 56 75 44 76 
               C 34 77 26 70 24 56 Z"
            fill="url(#silverRibbon)"
            fillOpacity="0.9"
            stroke="url(#silverStem)"
            strokeWidth="0.8"
            filter="url(#softShadow)"
          />

          {/* Sparkle star at top right */}
          <path
            d="M 94 34 
               Q 94 40 98 40 
               Q 94 40 94 46 
               Q 94 40 90 40 
               Q 94 40 94 34 Z"
            fill="url(#sparkleGrad)"
          />
        </svg>
      </div>

      {/* Brand Text */}
      {showText && (
        <span 
          className={`font-semibold text-[#1C1C1E] uppercase mt-1 text-center font-sans ${textSizes[size]}`}
          style={{ letterSpacing: size === 'sm' ? '0.22em' : '0.35em' }}
        >
          LAMAVI
        </span>
      )}
    </div>
  );
};
