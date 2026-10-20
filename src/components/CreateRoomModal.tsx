import React, { useState } from 'react';
import { X, Film, Check, Link as LinkIcon, Play, Radio } from 'lucide-react';
import { MOVIES_CATALOG, buildCustomMovie } from '../data/movies';
import { MovieItem } from '../types';
import { generateRoomCode } from './SyncEngine';
import { useAuth } from '../context/AuthContext';
import { isSafeMediaUrl, sanitizeSingleLine } from '../utils/security';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (roomData: {
    code: string;
    title: string;
    movie: MovieItem;
    hostName?: string;
  }) => void;
  initialMovie?: MovieItem | null;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onRoomCreated,
  initialMovie,
}) => {
  const { user } = useAuth();
  const [selectedMovie, setSelectedMovie] = useState<MovieItem>(
    initialMovie || MOVIES_CATALOG[0]
  );
  const [roomTitle, setRoomTitle] = useState(
    initialMovie ? `${initialMovie.title} Screening` : 'Campus Watch Night'
  );
  const [customHostName, setCustomHostName] = useState(user?.name || 'Guest');
  const [generatedCode] = useState(() => generateRoomCode());
  const [useCustomUrl, setUseCustomUrl] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [urlError, setUrlError] = useState('');

  if (!isOpen) return null;

  const handleCreate = () => {
    let finalMovie: MovieItem = selectedMovie;

    if (useCustomUrl) {
      const urlCheck = isSafeMediaUrl(customUrl);
      if (!urlCheck.valid) {
        setUrlError(urlCheck.error || 'Please provide a valid, secure HTTPS video stream URL.');
        return;
      }

      finalMovie = buildCustomMovie(customUrl, customTitle);
    }

    const cleanTitle = sanitizeSingleLine(roomTitle, 80) || `${finalMovie.title} Watch Party`;
    const cleanHostName = sanitizeSingleLine(customHostName, 40) || user?.name || 'Guest';

    onRoomCreated({
      code: generatedCode,
      title: cleanTitle,
      movie: finalMovie,
      hostName: cleanHostName,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl rounded-3xl bg-[#0f1117] border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08] bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#FAF7F1]">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-topic text-base font-bold text-[#FAF7F1]">Create Watch Room</h2>
              <p className="text-xs text-[#9c978b]">
                Passkey: <span className="font-mono text-[#FAF7F1] font-bold">{generatedCode.slice(0, 3)}-{generatedCode.slice(3)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-[#9c978b] hover:text-[#FAF7F1] hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Room Title & Host Name (Guest friendly) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-topic text-xs font-semibold text-[#FAF7F1] mb-1.5 uppercase tracking-wider">
                Room Name
              </label>
              <input
                type="text"
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                placeholder="e.g. Midnight Film Night"
                className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-[#FAF7F1] focus:outline-none focus:border-[#FAF7F1] focus:ring-1 focus:ring-[#FAF7F1]"
              />
            </div>
            <div>
              <label className="block font-topic text-xs font-semibold text-[#FAF7F1] mb-1.5 uppercase tracking-wider">
                Host Name (Guest Friendly)
              </label>
              <input
                type="text"
                value={customHostName}
                onChange={(e) => setCustomHostName(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={40}
                className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-[#FAF7F1] focus:outline-none focus:border-[#FAF7F1] focus:ring-1 focus:ring-[#FAF7F1]"
              />
            </div>
          </div>

          {/* Film Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="font-topic text-xs font-semibold text-[#FAF7F1] uppercase tracking-wider">
                Select Film
              </label>
              <button
                type="button"
                onClick={() => setUseCustomUrl(!useCustomUrl)}
                className="text-xs text-[#FAF7F1] hover:underline font-medium transition-colors cursor-pointer"
              >
                {useCustomUrl ? '← Pick from Library' : 'Or use custom video link →'}
              </button>
            </div>

            {!useCustomUrl ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MOVIES_CATALOG.map((movie) => {
                  const isSelected = selectedMovie.id === movie.id;
                  return (
                    <div
                      key={movie.id}
                      onClick={() => setSelectedMovie(movie)}
                      className={`relative flex gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#FAF7F1] bg-white/[0.06]'
                          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center shrink-0 text-[#FAF7F1]">
                        <Film className="w-5 h-5 text-[#FAF7F1]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-topic text-xs font-bold text-[#FAF7F1] truncate">
                            {movie.title}
                          </h4>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#FAF7F1] shrink-0" />}
                        </div>
                        <p className="text-[11px] text-[#9c978b] mt-0.5 font-mono">
                          {movie.duration} · {movie.year}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                <div>
                  <label className="block text-xs text-[#9c978b] mb-1">
                    Direct Video Stream URL (MP4 / WebM)
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-3 w-4 h-4 text-[#9c978b]" />
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => {
                        setCustomUrl(e.target.value);
                        if (urlError) setUrlError('');
                      }}
                      placeholder="https://example.com/movie.mp4"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-[#FAF7F1] focus:outline-none focus:border-[#FAF7F1]"
                    />
                  </div>
                  {urlError && (
                    <p className="text-[11px] text-rose-400 mt-1 font-medium">
                      {urlError}
                    </p>
                  )}
                  <p className="text-[11px] text-[#9c978b] mt-1.5">
                    Everyone who opens the room loads this video straight from that site, which can see their IP address. Only use sources you trust.
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-[#9c978b] mb-1">
                    Film Title
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Short Film Title"
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-[#FAF7F1] focus:outline-none focus:border-[#FAF7F1]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sync Information */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-start gap-3">
            <Radio className="w-4 h-4 text-[#FAF7F1] shrink-0 mt-0.5" />
            <div className="text-xs text-[#9c978b] leading-relaxed">
              <span className="font-semibold text-[#FAF7F1]">Shared Playback:</span>{' '}
              Anyone in the room can play, pause or seek and everyone follows. For now, sync works between tabs of this browser.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-black/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#9c978b] hover:text-[#FAF7F1] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-topic font-bold text-[#090a0d] bg-[#FAF7F1] hover:bg-white rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Synchronized Room</span>
          </button>
        </div>
      </div>
    </div>
  );
};
