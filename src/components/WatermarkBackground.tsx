import React from 'react';

export const WatermarkBackground: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.055] select-none"
    >
      <div className="flex flex-col items-center justify-center transform -rotate-12 scale-110">
        {/* Miniature school vector illustration */}
        <svg
          width="160"
          height="120"
          viewBox="0 0 160 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-slate-900 mb-2"
        >
          {/* Base school building */}
          <rect x="25" y="45" width="110" height="70" rx="2" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="3" />
          {/* Main Roof */}
          <polygon points="15,45 80,10 145,45" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="3" />
          {/* Bell tower / Clock tower */}
          <rect x="68" y="0" width="24" height="24" rx="2" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="80" cy="12" r="5" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
          {/* Flag */}
          <line x1="80" y1="0" x2="80" y2="-12" stroke="currentColor" strokeWidth="2" />
          <polygon points="80,-12 95,-7 80,-2" fill="currentColor" />
          {/* Windows */}
          <rect x="36" y="55" width="18" height="18" rx="1" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
          <line x1="45" y1="55" x2="45" y2="73" stroke="currentColor" strokeWidth="1.5" />
          <line x1="36" y1="64" x2="54" y2="64" stroke="currentColor" strokeWidth="1.5" />

          <rect x="106" y="55" width="18" height="18" rx="1" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
          <line x1="115" y1="55" x2="115" y2="73" stroke="currentColor" strokeWidth="1.5" />
          <line x1="106" y1="64" x2="124" y2="64" stroke="currentColor" strokeWidth="1.5" />

          <rect x="71" y="55" width="18" height="18" rx="1" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
          <line x1="80" y1="55" x2="80" y2="73" stroke="currentColor" strokeWidth="1.5" />
          <line x1="71" y1="64" x2="89" y2="64" stroke="currentColor" strokeWidth="1.5" />

          {/* School Entrance Door with steps */}
          <path d="M70 115 V90 Q80 82 90 90 V115 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" />
          <line x1="20" y1="115" x2="140" y2="115" stroke="currentColor" strokeWidth="3" />
        </svg>

        {/* Text Logo MonPilot */}
        <span className="text-4xl md:text-5xl font-extrabold tracking-wider text-slate-800 uppercase font-mono">
          MonPilot
        </span>
        <span className="text-xs font-bold tracking-widest text-slate-700 uppercase mt-1">
          Complexe Scolaire Privé CEMINACE • Brazzaville
        </span>
      </div>
    </div>
  );
};
