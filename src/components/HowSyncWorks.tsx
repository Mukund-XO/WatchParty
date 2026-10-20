import React from 'react';
import { Clock, KeyRound, MessageSquare, Radio } from 'lucide-react';

export const HowSyncWorks: React.FC = () => {
  return (
    <section id="how-sync-works" className="scroll-mt-20 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/[0.08]">
      <div className="max-w-3xl mx-auto text-center mb-12">
        <h2 className="font-topic text-2xl sm:text-3xl font-extrabold text-[#FAF7F1] tracking-tight">How Synchronized Streaming Works</h2>
        <p className="text-sm text-[#9c978b] mt-3 leading-relaxed">
          Each viewer's browser plays the video directly from its source. The room stores one shared fact, &ldquo;at this server time the
          video was at this position, playing or paused&rdquo;, and every player works out where it should be from that, so devices stay
          together even when their clocks differ.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <div className="p-6 rounded-3xl bg-[#0f1117] border border-white/10 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#FAF7F1]">
            <KeyRound className="w-5 h-5" />
          </div>
          <h3 className="font-topic text-base font-bold text-[#FAF7F1]">1. Private Room Code</h3>
          <p className="text-xs text-[#9c978b] leading-relaxed">
            Every room gets a random 10-character code. Rooms cannot be listed or searched, so only people you share the code or invite
            link with can join. Rooms are deleted after 24 hours.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-[#0f1117] border border-white/10 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#FAF7F1]">
            <Radio className="w-5 h-5" />
          </div>
          <h3 className="font-topic text-base font-bold text-[#FAF7F1]">2. Shared Playhead</h3>
          <p className="text-xs text-[#9c978b] leading-relaxed">
            The host (or everyone, if the host allows it) plays, pauses and seeks. Players that drift are nudged back by a tiny speed
            change, and people who join late land on the right moment. Typical accuracy is within a fraction of a second.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-[#0f1117] border border-white/10 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#FAF7F1]">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="font-topic text-base font-bold text-[#FAF7F1]">3. Chat and Reactions</h3>
          <p className="text-xs text-[#9c978b] leading-relaxed">
            Live chat tags each message with the video time. The host can jump the room to that moment, and can remove messages or
            viewers if needed.
          </p>
        </div>
      </div>

      <div className="mt-10 max-w-4xl mx-auto p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#FAF7F1] shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-xs text-[#9c978b]">
            <span className="font-semibold text-[#FAF7F1]">Try it: </span>
            create a room, send the invite link to a friend (or open it on your phone), and press play. Everyone's video starts together.
            If your browser blocks autoplay, tap the video once to join.
          </div>
        </div>
      </div>
    </section>
  );
};
