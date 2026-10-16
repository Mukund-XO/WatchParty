import React, { useRef, useState } from 'react';
import { Film, Play, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { MOVIES_CATALOG } from '../data/movies';
import { MovieItem } from '../types';

interface ListingsGridProps {
  onSelectMovieToHost: (movie: MovieItem) => void;
  onQuickJoinDemo?: (code: string) => void;
}

export const ListingsGrid: React.FC<ListingsGridProps> = ({
  onSelectMovieToHost,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [previewMovie, setPreviewMovie] = useState<MovieItem | null>(null);

  const checkScrollability = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  const slide = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const offset = direction === 'left' ? -380 : 380;
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(checkScrollability, 300);
    }
  };

  return (
    <section id="listings-grid" className="scroll-mt-20 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section Header with Space Grotesk font & slide controls */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div>
          <h2 className="font-topic text-xl sm:text-2xl font-bold text-[#FAF7F1] tracking-tight">
            Curated Screenings
          </h2>
          <p className="text-xs text-[#9c978b] mt-0.5">
            Slide through available campus films and launch a synchronized room.
          </p>
        </div>

        {/* Carousel Slide Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => slide('left')}
            disabled={!canScrollLeft}
            className={`p-2 rounded-xl border border-white/10 transition-all ${
              canScrollLeft
                ? 'bg-white/[0.05] hover:bg-white/[0.1] text-[#FAF7F1] hover:border-[#FAF7F1]/50 cursor-pointer'
                : 'opacity-30 text-[#9c978b] cursor-not-allowed'
            }`}
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => slide('right')}
            disabled={!canScrollRight}
            className={`p-2 rounded-xl border border-white/10 transition-all ${
              canScrollRight
                ? 'bg-white/[0.05] hover:bg-white/[0.1] text-[#FAF7F1] hover:border-[#FAF7F1]/50 cursor-pointer'
                : 'opacity-30 text-[#9c978b] cursor-not-allowed'
            }`}
            aria-label="Next slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Slides Container (Compact height, horizontal scroll) */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScrollability}
        className="flex gap-4 overflow-x-auto py-5 scroll-smooth custom-scrollbar snap-x snap-mandatory"
        style={{ scrollbarWidth: 'thin' }}
      >
        {MOVIES_CATALOG.map((movie, index) => (
          <div
            key={movie.id}
            className="flex-none w-[310px] sm:w-[350px] snap-start rounded-2xl bg-[#0f1117] border border-white/10 hover:border-[#FAF7F1]/40 transition-all duration-200 overflow-hidden shadow-lg flex flex-col justify-between group"
          >
            {/* Top Film Frame Strip with Perforation Styling */}
            <div className="p-4 bg-gradient-to-r from-black/60 to-white/[0.02] border-b border-white/[0.06] relative">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.05] opacity-50">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1 rounded-[1px] bg-white/40" />
                  <span className="w-1.5 h-1 rounded-[1px] bg-white/40" />
                  <span className="w-1.5 h-1 rounded-[1px] bg-white/40" />
                </div>
                <span className="font-mono text-[10px] text-[#9c978b]">REEL #{index + 1}</span>
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1 rounded-[1px] bg-white/40" />
                  <span className="w-1.5 h-1 rounded-[1px] bg-white/40" />
                  <span className="w-1.5 h-1 rounded-[1px] bg-white/40" />
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-topic text-base font-bold text-[#FAF7F1] truncate group-hover:text-white transition-colors">
                    {movie.title}
                  </h3>
                  <p className="text-[11px] text-[#9c978b] truncate mt-0.5 font-mono">
                    {movie.duration} · {movie.year} · {movie.genre}
                  </p>
                </div>

                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#FAF7F1] shrink-0">
                  <Film className="w-4 h-4 text-[#FAF7F1]" />
                </div>
              </div>
            </div>

            {/* Mid description */}
            <div className="p-4 flex-1">
              <p className="text-xs text-[#9c978b] line-clamp-2 leading-relaxed">
                {movie.description}
              </p>
              <div className="mt-2 text-[11px] font-mono text-[#9c978b]">
                Directed by <span className="text-[#FAF7F1]">{movie.director}</span>
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div className="px-4 py-3 bg-black/30 border-t border-white/[0.06] flex items-center justify-between gap-2">
              <button
                onClick={() => setPreviewMovie(movie)}
                className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-medium text-[#9c978b] hover:text-[#FAF7F1] border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                <span>Preview</span>
              </button>

              <button
                onClick={() => onSelectMovieToHost(movie)}
                className="px-4 py-1.5 rounded-xl bg-[#FAF7F1] hover:bg-white text-xs font-topic font-bold text-[#090a0d] transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Host Room</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Preview Modal */}
      {previewMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-3xl bg-[#0f1117] border border-white/10 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
              <div>
                <h3 className="font-topic text-sm font-bold text-[#FAF7F1]">
                  {previewMovie.title}
                </h3>
                <p className="text-xs text-[#9c978b] font-mono">{previewMovie.duration} · {previewMovie.genre}</p>
              </div>
              <button
                onClick={() => setPreviewMovie(null)}
                className="text-[#9c978b] hover:text-[#FAF7F1] text-xs font-mono px-2 py-1 rounded-lg border border-white/10 cursor-pointer"
              >
                Close (ESC)
              </button>
            </div>
            <div className="p-4 bg-black">
              <video
                src={previewMovie.videoUrl}
                controls
                autoPlay
                className="w-full rounded-2xl aspect-video bg-black object-contain max-h-[340px]"
              />
            </div>
            <div className="p-4 flex items-center justify-between border-t border-white/[0.08]">
              <div className="text-xs text-[#9c978b]">
                Directed by <span className="text-[#FAF7F1]">{previewMovie.director}</span>
              </div>
              <button
                onClick={() => {
                  const m = previewMovie;
                  setPreviewMovie(null);
                  onSelectMovieToHost(m);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#090a0d] font-topic text-xs font-bold transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Host Synchronized Screening</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
