import React from 'react';

interface ClapperLogoProps {
  className?: string;
  onClick?: () => void;
}

export const ClapperLogo: React.FC<ClapperLogoProps> = ({
  className = 'h-10 w-auto',
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`group relative inline-flex items-center justify-center p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FAF7F1] rounded-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer ${className}`}
      aria-label="Watch Party - Home"
    >
      <svg
        viewBox="0 0 200 190"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-10 w-10 drop-shadow-sm select-none"
        style={{ color: 'var(--accent, #FAF7F1)' }}
      >
        {/* Tilted clapperboard container rotated clockwise 9 degrees */}
        <g transform="rotate(9 100 95)">
        {/* Sketch Action Lines around the clapperboard */}
        {/* Top-right burst speed line */}
        <path
          d="M 94 20 L 144 14"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        {/* Open clapper jaw action sparks */}
        <path
          d="M 152 44 L 170 38"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M 150 56 L 174 60"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        {/* Left vertical sketch margin mark */}
        <path
          d="M 28 72 L 25 124"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Right vertical sketch margin mark */}
        <path
          d="M 148 122 L 146 142"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Bottom underline dash sketch marks */}
        <path
          d="M 86 172 L 98 172"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M 108 173 L 142 175"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
        />

        {/* --- Top Open Clapstick (Angled up ~12 deg) --- */}
        <g id="top-clapstick">
          {/* Main arm body */}
          <path
            d="M 44 48 L 56 30 L 150 18 L 152 38 L 44 48 Z"
            stroke="currentColor"
            strokeWidth="5.5"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Diagonal black/white stripes on top arm */}
          <path
            d="M 64 36 L 76 25 L 88 23 L 74 38 Z"
            fill="currentColor"
          />
          <path
            d="M 88 34 L 100 23 L 112 21 L 98 36 Z"
            fill="currentColor"
          />
          <path
            d="M 112 32 L 124 21 L 136 19 L 122 34 Z"
            fill="currentColor"
          />
          <path
            d="M 136 30 L 146 20 L 150 20 L 144 32 Z"
            fill="currentColor"
          />
        </g>

        {/* Left Circular Hinge Pivot */}
        <g id="clapper-hinge">
          <circle
            cx="40"
            cy="56"
            r="12"
            stroke="currentColor"
            strokeWidth="5.5"
            fill="#090a0d"
          />
          <circle
            cx="40"
            cy="56"
            r="4.5"
            fill="currentColor"
          />
        </g>

        {/* --- Middle Horizontal Clapstick Base --- */}
        <g id="middle-bar">
          <path
            d="M 36 60 L 152 60 L 148 78 L 36 78 Z"
            stroke="currentColor"
            strokeWidth="5.5"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Diagonal stripes on middle base */}
          <path
            d="M 48 76 L 62 62 L 74 62 L 60 76 Z"
            fill="currentColor"
          />
          <path
            d="M 72 76 L 86 62 L 98 62 L 84 76 Z"
            fill="currentColor"
          />
          <path
            d="M 96 76 L 110 62 L 122 62 L 108 76 Z"
            fill="currentColor"
          />
          <path
            d="M 120 76 L 134 62 L 144 62 L 132 76 Z"
            fill="currentColor"
          />
        </g>

        {/* --- Lower Slate Board --- */}
        <g id="slate-board">
          {/* Slate outer frame with rounded corners */}
          <rect
            x="36"
            y="76"
            width="106"
            height="84"
            rx="8"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Slate Inner Border */}
          <rect
            x="44"
            y="84"
            width="90"
            height="68"
            rx="4"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            opacity="0.85"
          />

          {/* Top thick horizontal block band */}
          <rect
            x="48"
            y="88"
            width="82"
            height="24"
            rx="2"
            fill="currentColor"
          />

          {/* Bottom horizontal block band */}
          <rect
            x="48"
            y="126"
            width="82"
            height="18"
            rx="2"
            fill="currentColor"
          />
        </g>
        </g>
      </svg>
    </button>
  );
};
