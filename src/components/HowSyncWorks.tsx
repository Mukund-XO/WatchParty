import React from 'react';
import { Wifi, KeyRound, MessageSquare, Clock } from 'lucide-react';

export const HowSyncWorks: React.FC = () => {
  return (
    <section id="how-sync-works" className="scroll-mt-20 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/[0.08]">
      <div className="max-w-3xl mx-auto text-center mb-12">
        <h2 className="font-topic text-2xl sm:text-3xl font-extrabold text-[#FAF7F1] tracking-tight">
          How Synchronized Streaming Works
        </h2>
        <p className="text-sm text-[#9c978b] mt-3 leading-relaxed">
          Watch Party broadcasts play, pause and seek events between the open tabs of a room using the browser's BroadcastChannel API. There is no server yet, so rooms do not reach other browsers or devices.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <div className="p-6 rounded-3xl bg-[#0f1117] border border-white/10 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#FAF7F1]">
            <KeyRound className="w-5 h-5" />
          </div>
          <h3 className="font-topic text-base font-bold text-[#FAF7F1]">1. Six-Digit Room Pass</h3>
          <p className="text-xs text-[#9c978b] leading-relaxed">
            Every room gets a random 6-digit key. Enter it, or open the invite link, in another tab of this browser to join.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-[#0f1117] border border-white/10 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#FAF7F1]">
            <Wifi className="w-5 h-5" />
          </div>
          <h3 className="font-topic text-base font-bold text-[#FAF7F1]">2. Shared Playback Events</h3>
          <p className="text-xs text-[#9c978b] leading-relaxed">
            Play, pause and seek events are sent to every open tab in the room. A tab that joins late asks the others for their current position.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-[#0f1117] border border-white/10 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#FAF7F1]">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="font-topic text-base font-bold text-[#FAF7F1]">3. Campus Margin Notes</h3>
          <p className="text-xs text-[#9c978b] leading-relaxed">
            Notebook-styled live chat automatically attaches video timestamps to comments, letting viewers jump directly to key cuts.
          </p>
        </div>
      </div>

      {/* Multi-Tab Testing Tip Banner */}
      <div className="mt-10 max-w-4xl mx-auto p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#FAF7F1] shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-xs text-[#9c978b]">
            <span className="font-semibold text-[#FAF7F1]">Try it right now: </span>
            Launch a watch room, copy the 6-digit code or link, open it in another tab of the same browser, and press play. Both tabs will play and pause together. A different browser, a private window or another device will not see the room.
          </div>
        </div>
      </div>
    </section>
  );
};
