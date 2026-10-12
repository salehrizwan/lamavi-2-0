import React from 'react';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isOnline?: boolean;
  showOnlineStatus?: boolean;
  statusRing?: 'none' | 'unviewed' | 'viewed';
  className?: string;
  onClick?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  avatarUrl,
  size = 'md',
  isOnline = false,
  showOnlineStatus = false,
  statusRing = 'none',
  className = '',
  onClick
}) => {
  const sizeClasses = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-9 h-9 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl font-medium',
    '2xl': 'w-28 h-28 text-3xl font-medium'
  };

  const onlineDotSizes = {
    xs: 'w-2 h-2 -bottom-0.5 -right-0.5',
    sm: 'w-2.5 h-2.5 bottom-0 right-0',
    md: 'w-3 h-3 bottom-0.5 right-0.5 ring-2',
    lg: 'w-3.5 h-3.5 bottom-0.5 right-0.5 ring-2',
    xl: 'w-4 h-4 bottom-1 right-1 ring-3',
    '2xl': 'w-5 h-5 bottom-1 right-1 ring-3'
  };

  const getInitials = (n: string) => {
    if (!n) return 'L';
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Status ring styles
  let ringStyle = '';
  if (statusRing === 'unviewed') {
    ringStyle = 'p-[2px] bg-gradient-to-tr from-[#94A3B8] via-[#E2E8F0] to-[#64748B] rounded-full';
  } else if (statusRing === 'viewed') {
    ringStyle = 'p-[2px] bg-[#E5E5EA] rounded-full';
  }

  return (
    <div 
      className={`relative inline-block select-none shrink-0 ${ringStyle} ${onClick ? 'cursor-pointer hover:opacity-95' : ''} ${className}`}
      onClick={onClick}
    >
      <div 
        className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#F1F3F5] via-[#E9ECEF] to-[#DEE2E6] border border-[#E5E5EA] text-[#495057] font-semibold tracking-wider shadow-2xs`}
      >
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={name} 
            className="w-full h-full object-cover" 
            onError={(e) => {
              // Hide image on error and fallback to initials
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>

      {showOnlineStatus && (
        <span 
          className={`absolute ${onlineDotSizes[size]} rounded-full ${
            isOnline ? 'bg-emerald-500 ring-white' : 'bg-transparent ring-transparent'
          }`} 
        />
      )}
    </div>
  );
};
