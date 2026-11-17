import React from 'react';

interface WaluhLogoProps {
  className?: string;
  alt?: string;
}

export const WALUH_LOGO_SRC = '/assets/aistudio/IMG_7016_45580aff.jpeg';

export const WaluhLogo: React.FC<WaluhLogoProps> = ({ className = 'h-10 w-10', alt = 'WALUH FAMILY Official Crest' }) => {
  return (
    <img
      src={WALUH_LOGO_SRC}
      alt={alt}
      referrerPolicy="no-referrer"
      className={`object-contain select-none ${className}`}
    />
  );
};

interface AvatarProps {
  src?: string;
  name: string;
  sizeClass?: string;
}

export const MemberAvatar: React.FC<AvatarProps> = ({ src, name, sizeClass = 'h-10 w-10 text-xs' }) => {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        className={`rounded-full object-cover border border-slate-500/30 bg-[#0c0d10] shrink-0 ${sizeClass}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`rounded-full flex items-center justify-center font-display font-semibold text-slate-200 bg-gradient-to-br from-[#232732] to-[#0d0f13] border border-slate-400/25 shrink-0 ${sizeClass}`}
    >
      {initials || 'WF'}
    </div>
  );
};
