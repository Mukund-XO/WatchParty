import React, { useState } from 'react';
import { X, Film, Check, Link as LinkIcon, Play, Radio, Loader2, Users, Crown } from 'lucide-react';
import { MOVIES_CATALOG } from '../data/movies';
import { ControlMode, MovieItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { createRoom, RoomError } from '../lib/rooms';
import { checkMediaUrl, sanitizeSingleLine } from '../utils/security';

interface CreateRoomModalProps {
  onClose: () => void;
  /** Called with the new room's code once the server has created it. */
  onRoomCreated: (code: string) => void;
  initialMovie?: MovieItem | null;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ onClose, onRoomCreated, initialMovie }) => {
  const { user, status, setDisplayName } = useAuth();
  const [selectedMovie, setSelectedMovie] = useState<MovieItem>(initialMovie || MOVIES_CATALOG[0]);
  const [roomTitle, setRoomTitle] = useState(initialMovie ? `${initialMovie.title} Screening` : 'Watch Night');
  const [hostName, setHostName] = useState(user.name);
  const [controlMode, setControlMode] = useState<ControlMode>('host');
  const [useCustomUrl, setUseCustomUrl] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [urlError, setUrlError] = useState('');
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setFormError('');
    setUrlError('');

    let videoUrl = selectedMovie.videoUrl;
    let videoTitle = selectedMovie.title;

    if (useCustomUrl) {
      const urlCheck = checkMediaUrl(customUrl);
      if (!urlCheck.ok) {
        setUrlError(urlCheck.error);
        return;
      }
      videoUrl = urlCheck.url;
      videoTitle = sanitizeSingleLine(customTitle, 80) || 'Custom video';
    }

    const title = sanitizeSingleLine(roomTitle, 80) || `${videoTitle} Watch Party`;
    const name = sanitizeSingleLine(hostName, 40);
    if (name) setDisplayName(name);

    setCreating(true);
    try {
      const code = await createRoom({ title, videoUrl, videoTitle, controlMode });
      onRoomCreated(code);
    } catch (error) {
      setFormError(error instanceof RoomError ? error.message : 'Could not create the room. Try again.');
      setCreating(false);
    }
  };

  const labelClass = 'block font-topic text-xs font-semibold text-[#FAF7F1] mb-1.5 uppercase tracking-wider';
  const inputClass =
    'w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-[#FAF7F1] focus:outline-none focus:border-[#FAF7F1] focus:ring-1 focus:ring-[#FAF7F1]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Create watch room"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-[#0f1117] border border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08] bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#FAF7F1]">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-topic text-base font-bold text-[#FAF7F1]">Create Watch Room</h2>
              <p className="text-xs text-[#9c978b]">You get a private room code to share once it is created.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-xl text-[#9c978b] hover:text-[#FAF7F1] hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="room-title" className={labelClass}>
                Room Name
              </label>
              <input
                id="room-title"
                type="text"
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                placeholder="e.g. Midnight Film Night"
                maxLength={80}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="host-name" className={labelClass}>
                Your Name
              </label>
              <input
                id="host-name"
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={40}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className={labelClass + ' mb-0'}>Select Film</span>
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
                    <button
                      type="button"
                      key={movie.id}
                      onClick={() => setSelectedMovie(movie)}
                      aria-pressed={isSelected}
                      className={`relative flex gap-3 p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                        isSelected ? 'border-[#FAF7F1] bg-white/[0.06]' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center shrink-0 text-[#FAF7F1]">
                        <Film className="w-5 h-5 text-[#FAF7F1]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-topic text-xs font-bold text-[#FAF7F1] truncate">{movie.title}</h4>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#FAF7F1] shrink-0" />}
                        </div>
                        <p className="text-[11px] text-[#9c978b] mt-0.5 font-mono">
                          {movie.duration} · {movie.year}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                <div>
                  <label htmlFor="custom-url" className="block text-xs text-[#9c978b] mb-1">
                    Direct video link (MP4 or WebM, https only)
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-3 w-4 h-4 text-[#9c978b]" />
                    <input
                      id="custom-url"
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
                  {urlError && <p className="text-[11px] text-rose-400 mt-1 font-medium">{urlError}</p>}
                  <p className="text-[11px] text-[#9c978b] mt-1.5">
                    Everyone in the room loads this video straight from that site, which can see their IP address. Only use sources you
                    trust, and only videos you have the right to share. Pages such as YouTube are not direct video links and will not play.
                  </p>
                </div>
                <div>
                  <label htmlFor="custom-title" className="block text-xs text-[#9c978b] mb-1">
                    Video title
                  </label>
                  <input
                    id="custom-title"
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Short film title"
                    maxLength={80}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-[#FAF7F1] focus:outline-none focus:border-[#FAF7F1]"
                  />
                </div>
              </div>
            )}
          </div>

          <fieldset>
            <legend className={labelClass}>Who controls playback?</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  { mode: 'host', icon: Crown, title: 'Only me', text: 'You play, pause and seek. Everyone follows.' },
                  { mode: 'everyone', icon: Users, title: 'Everyone', text: 'Anyone in the room can control playback.' },
                ] as const
              ).map(({ mode, icon: Icon, title, text }) => (
                <label
                  key={mode}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    controlMode === mode ? 'border-[#FAF7F1] bg-white/[0.06]' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="control-mode"
                    value={mode}
                    checked={controlMode === mode}
                    onChange={() => setControlMode(mode)}
                    className="sr-only"
                  />
                  <Icon className="w-4 h-4 mt-0.5 text-[#FAF7F1] shrink-0" />
                  <span>
                    <span className="block font-topic text-xs font-bold text-[#FAF7F1]">{title}</span>
                    <span className="block text-[11px] text-[#9c978b] mt-0.5">{text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-start gap-3">
            <Radio className="w-4 h-4 text-[#FAF7F1] shrink-0 mt-0.5" />
            <div className="text-xs text-[#9c978b] leading-relaxed">
              <span className="font-semibold text-[#FAF7F1]">Private by code:</span> rooms cannot be listed or searched. Only people you
              give the code or invite link to can join, and the room is deleted after 24 hours.
            </div>
          </div>

          {formError && (
            <p role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-xl px-3 py-2">
              {formError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-black/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#9c978b] hover:text-[#FAF7F1] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || status !== 'ready'}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-topic font-bold text-[#090a0d] bg-[#FAF7F1] hover:bg-white rounded-xl transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{creating ? 'Creating...' : status === 'ready' ? 'Create Room' : 'Connecting...'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
