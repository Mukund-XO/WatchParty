import React from 'react';

interface MovieReelWPLogoProps {
  className?: string;
  onClick?: () => void;
}

export const MovieReelWPLogo: React.FC<MovieReelWPLogoProps> = ({
  className = 'h-10 w-auto',
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`group relative inline-flex items-center justify-center p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#800000] rounded-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer ${className}`}
      aria-label="WP Cinema - Home"
    >
      <svg
        viewBox="0 0 160 52"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-10 w-auto drop-shadow-md"
      >
        <defs>
          {/* Maroon film strip gradient */}
          <linearGradient id="wpFilmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9b111e" />
            <stop offset="50%" stopColor="#800000" />
            <stop offset="100%" stopColor="#550000" />
          </linearGradient>

          {/* Film ribbon border glow */}
          <linearGradient id="wpReelStroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f4f1ea" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#e5dfd3" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#f4f1ea" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* --- Left Film Reel Spool (Starting roll) --- */}
        <g id="start-reel" transform="translate(6, 6)">
          {/* Reel outer rim */}
          <circle cx="16" cy="16" r="15" fill="#140606" stroke="#800000" strokeWidth="2.5" />
          <circle cx="16" cy="16" r="14" stroke="#f4f1ea" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.4" />
          
          {/* Reel cutouts (projector film reel holes) */}
          <circle cx="16" cy="8" r="3" fill="#090a0d" stroke="#800000" strokeWidth="1" />
          <circle cx="23" cy="18" r="3" fill="#090a0d" stroke="#800000" strokeWidth="1" />
          <circle cx="9" cy="18" r="3" fill="#090a0d" stroke="#800000" strokeWidth="1" />
          
          {/* Reel central spindle hub */}
          <circle cx="16" cy="16" r="4.5" fill="#800000" stroke="#f4f1ea" strokeWidth="1.2" />
          <circle cx="16" cy="16" r="1.5" fill="#f4f1ea" />
        </g>

        {/* --- Film Ribbon Strip forming the 'W' and curling into 'P' --- */}
        {/*
            Path coordinates:
            Starts from reel top-right (26, 12),
            Dips down to First V valley (44, 44),
            Rises to Central Peak (64, 14),
            Dips down to Second V valley (84, 44),
            Rises up to Right Stem (104, 10),
            Then loops out to the right in a rounded loop (128, 10 -> 136, 22 -> 128, 32 -> 104, 32)
            forming the 'P' head on the right!
        */}

        {/* Outer thick film ribbon path with drop outline */}
        <path
          d="M 26 14
             C 32 14, 38 40, 44 44
             C 50 48, 58 18, 64 14
             C 70 11, 78 40, 84 44
             C 90 48, 98 16, 104 10
             C 112 3, 136 2, 136 20
             C 136 33, 118 34, 104 34
             L 104 46"
          stroke="#3d0000"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Main Maroon film body */}
        <path
          d="M 26 14
             C 32 14, 38 40, 44 44
             C 50 48, 58 18, 64 14
             C 70 11, 78 40, 84 44
             C 90 48, 98 16, 104 10
             C 112 3, 136 2, 136 20
             C 136 33, 118 34, 104 34
             L 104 46"
          stroke="url(#wpFilmGradient)"
          strokeWidth="8.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Top/inner film edge highlight */}
        <path
          d="M 26 14
             C 32 14, 38 40, 44 44
             C 50 48, 58 18, 64 14
             C 70 11, 78 40, 84 44
             C 90 48, 98 16, 104 10
             C 112 3, 136 2, 136 20
             C 136 33, 118 34, 104 34
             L 104 46"
          stroke="url(#wpReelStroke)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />

        {/* Center sprocket perforation dashed track along the film ribbon */}
        <path
          d="M 26 14
             C 32 14, 38 40, 44 44
             C 50 48, 58 18, 64 14
             C 70 11, 78 40, 84 44
             C 90 48, 98 16, 104 10
             C 112 3, 136 2, 136 20
             C 136 33, 118 34, 104 34
             L 104 46"
          stroke="#f4f1ea"
          strokeWidth="2.2"
          strokeDasharray="2.5 3.5"
          strokeLinecap="butt"
          strokeLinejoin="round"
          opacity="0.9"
        />

        {/* Center cutout inside the 'P' head (forming the film eyehole) */}
        <ellipse cx="118" cy="20" rx="6" ry="5.5" fill="#090a0d" stroke="#f4f1ea" strokeWidth="1" opacity="0.9" />

        {/* Film reel roll curl accent at the base of P */}
        <circle cx="104" cy="46" r="3" fill="#800000" stroke="#f4f1ea" strokeWidth="1" />
      </svg>
    </button>
  );
};
