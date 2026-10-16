import React from 'react';
import { Film } from 'lucide-react';

interface FooterProps {
  onScrollToListings: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onScrollToListings }) => {
  return (
    <footer className="border-t border-white/[0.08] bg-[#090a0d] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#FAF7F1]">
            <Film className="w-3.5 h-3.5" />
          </div>
          <span className="font-topic text-sm font-bold text-[#FAF7F1]">Watch Party</span>
          <span className="text-xs text-[#9c978b]">·</span>
          <span className="text-xs text-[#9c978b]">Synchronized Film Experience</span>
        </div>

        <div className="flex items-center gap-6 text-xs text-[#9c978b]">
          <button
            onClick={onScrollToListings}
            className="hover:text-[#FAF7F1] transition-colors cursor-pointer"
          >
            Curated Screenings
          </button>
          <a
            href="#how-sync-works"
            className="hover:text-[#FAF7F1] transition-colors"
          >
            Sync Protocol
          </a>
          <span>VIT Campus Network</span>
        </div>

        <div className="text-xs text-[#9c978b] font-mono">
          © {new Date().getFullYear()} Watch Party. All playback synchronized.
        </div>
      </div>
    </footer>
  );
};
