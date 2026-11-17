import { useEffect, useState } from 'react';
import { apiFetch } from './lib/api';
import type { PublicOverview, UserProfile } from './types';
import { PublicHomepage } from './components/PublicHomepage';
import { AuthModal } from './components/AuthModal';
import { DashboardShell } from './components/DashboardShell';

export default function App() {
  const [overview, setOverview] = useState<PublicOverview | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [booting, setBooting] = useState(true);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);

  const fetchOverview = async () => {
    try {
      const ov = await apiFetch<PublicOverview>('/api/public/overview');
      setOverview(ov);
    } catch {
      // Keep current state if temporary network error
    }
  };

  const fetchMe = async () => {
    try {
      const me = await apiFetch<{ user: UserProfile; unreadNotifications: number }>('/api/auth/me');
      setUser(me.user);
      setUnreadNotifications(me.unreadNotifications);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    Promise.all([fetchOverview(), fetchMe()]).finally(() => setBooting(false));
  }, []);

  if (booting) {
    return (
      <div className="min-h-screen bg-[#050506] flex flex-col items-center justify-center gap-4">
        <img
          src="/assets/aistudio/IMG_7016_45580aff.jpeg"
          alt="WALUH FAMILY"
          className="h-20 w-20 object-contain opacity-90 animate-pulse"
        />
        <p className="font-display text-sm tracking-[0.25em] text-slate-400">WALUH FAMILY</p>
      </div>
    );
  }

  if (user && overview) {
    return (
      <DashboardShell
        user={user}
        community={overview.community}
        initialUnread={unreadNotifications}
        onRefreshUser={fetchMe}
        onRefreshCommunity={fetchOverview}
        onLoggedOut={() => {
          setUser(null);
          fetchOverview();
        }}
      />
    );
  }

  return (
    <>
      <PublicHomepage overview={overview} onOpenAuth={(mode) => setAuthModalMode(mode)} />
      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          rules={overview?.community.rules ?? []}
          onClose={() => setAuthModalMode(null)}
          onSuccessLogin={async (loggedUser) => {
            setUser(loggedUser);
            setAuthModalMode(null);
            await Promise.all([fetchMe(), fetchOverview()]);
          }}
        />
      )}
    </>
  );
}
