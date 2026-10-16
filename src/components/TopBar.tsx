import React, { useState } from 'react';
import { User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AccountModal } from './AccountModal';
import { ClapperLogo } from './ClapperLogo';

interface TopBarProps {
  onNavigateHome: () => void;
  onScrollToListings?: () => void;
  onCreateRoomClick?: () => void;
  onJoinRoomClick?: () => void;
  inRoom?: boolean;
  activeRoomId?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  onNavigateHome,
}) => {
  const { user, isGuest } = useAuth();
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  return (
    <>
      <header
        style={{
          backgroundColor: 'var(--topbar-bg, #0c0e12)',
          borderBottom: '1px solid var(--topbar-border, rgba(250, 247, 241, 0.15))',
        }}
        className="sticky top-0 z-40 w-full transition-colors duration-200"
      >
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left spacer for perfect centering of the logo */}
          <div className="w-20 sm:w-24 flex items-center" />

          {/* Centered Clapperboard Logo (preserving 9° clockwise tilt) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <ClapperLogo onClick={onNavigateHome} />
          </div>

          {/* Right: Small, clean normal account/guest button with accent integration */}
          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 hover:border-[var(--accent)] hover:text-[var(--accent)]"
              style={{
                borderColor: 'var(--accent-subtle, rgba(250, 247, 241, 0.2))',
              }}
              aria-label={isGuest ? 'Guest Profile & Website Accent' : 'Account Details & Website Accent'}
              title="Account & Website Accent Settings"
            >
              <User className="w-3.5 h-3.5 text-[#FAF7F1]/80" />
              <span className="text-[#FAF7F1]">{user?.name || 'Guest'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Account Details & Appearance Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
      />
    </>
  );
};
