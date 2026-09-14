import React from 'react';

export const WatermarkBackground: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.055] select-none"
    >
      <div className="flex flex-col items-center justify-center transform -rotate-12 scale-110">
        <img src="/monpilot-cat.svg" alt="" className="w-40 h-40 object-contain mb-2" />

        {/* Text Logo MonPilot */}
        <span className="text-4xl md:text-5xl font-extrabold tracking-wider text-slate-800 uppercase font-mono">
          MonPilot School ERP
        </span>
        <span className="text-xs font-bold tracking-widest text-slate-700 uppercase mt-1">
          Complexe Scolaire Privé CEMINACE • Brazzaville
        </span>
      </div>
    </div>
  );
};
