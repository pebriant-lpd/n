import React, { useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  Calendar,
  Coins,
  FileText,
  History,
  LayoutDashboard,
  Landmark,
  LogOut,
  Megaphone,
  Menu,
  Network,
  Settings,
  Shield,
  Sliders,
  UserCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { apiFetch, formatDateId, formatDateTimeWib } from '../lib/api';
import type { CommunityInfo, DashboardTab, NotificationItem, UserProfile } from '../types';
import { MemberAvatar, WaluhLogo } from './WaluhLogo';
import { OverviewView } from './dashboard/OverviewView';
import { DonationTransparencyView, MyDonationHistoryView } from './dashboard/DonationTransparencyView';
import { TreasurerDashboardView } from './dashboard/TreasurerDashboardView';
import { AnnouncementsView, EventsView } from './dashboard/EventsAndAnnouncementsView';
import { MemberDirectoryView, OrganizationStructureView } from './dashboard/DirectoryAndOrgView';
import {
  AuditLogsView,
  CommunitySettingsEditorView,
  MembersGovernanceView,
  RegistrationsAdminView,
  RolesPermissionsView,
} from './dashboard/GovernanceViews';
import { CommunityRulesView, MyProfileView, SettingsView } from './dashboard/ProfileAndSettingsView';

interface DashboardShellProps {
  user: UserProfile;
  community: CommunityInfo;
  initialUnread: number;
  onRefreshUser: () => Promise<void>;
  onRefreshCommunity: () => Promise<void>;
  onLoggedOut: () => void;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  user,
  community,
  initialUnread,
  onRefreshUser,
  onRefreshCommunity,
  onLoggedOut,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnread);

  const hasPerm = (perm: string) => user.roleCode === 'CAPSU' || user.permissions.includes(perm);

  const loadNotifications = async () => {
    try {
      const res = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
      setNotifications(res.notifications);
      setUnreadCount(res.notifications.filter((n) => !n.is_read).length);
    } catch {
      // Ignore silent background poll error
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [activeTab]);

  const markRead = async (id?: string) => {
    await apiFetch('/api/notifications/read', {
      method: 'POST',
      body: JSON.stringify(id ? { id } : {}),
    });
    await loadNotifications();
  };

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    onLoggedOut();
  };

  const memberLinks: Array<{ id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'profile', label: 'My Profile', icon: UserCog },
    { id: 'directory', label: 'Member Directory', icon: Users },
    { id: 'donations', label: 'Donation Information', icon: Coins },
    { id: 'my-donations', label: 'Donation History', icon: History },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'organization', label: 'Organization Structure', icon: Network },
    { id: 'rules', label: 'Community Rules', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const officerLinksRaw: Array<{
    id: DashboardTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
  }> = [
    {
      id: 'treasurer',
      label: 'Treasurer Dashboard',
      icon: Landmark,
      visible: hasPerm('donations.create') || hasPerm('donations.view_all'),
    },
    {
      id: 'registrations',
      label: 'Registrations',
      icon: UserCheck,
      visible: hasPerm('registrations.review'),
    },
    {
      id: 'members-admin',
      label: 'Member Governance',
      icon: Users,
      visible: hasPerm('members.manage'),
    },
    {
      id: 'roles-admin',
      label: 'Role & Permissions',
      icon: Shield,
      visible: hasPerm('roles.configure'),
    },
    {
      id: 'audit-logs',
      label: 'Audit Logs',
      icon: FileText,
      visible: hasPerm('audit.view'),
    },
    {
      id: 'community-settings',
      label: 'Community Settings',
      icon: Sliders,
      visible: hasPerm('settings.manage'),
    },
  ];
  const officerLinks = officerLinksRaw.filter((item) => item.visible);

  const allTabLabels: Record<DashboardTab, string> = {
    overview: 'Overview',
    profile: 'My Profile',
    directory: 'Member Directory',
    donations: 'Donation Transparency',
    'my-donations': 'Donation History',
    events: 'Events',
    announcements: 'Announcements',
    organization: 'Organization Structure',
    rules: 'Community Rules',
    settings: 'Settings',
    treasurer: 'Treasurer Dashboard',
    registrations: 'Registrations Approval',
    'members-admin': 'Member Governance',
    'roles-admin': 'Role & Permissions',
    'audit-logs': 'Audit Logs',
    'community-settings': 'Community Settings',
  };

  const selectTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    setNotifOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#07080b] border-r border-slate-300/15">
      {/* Brand */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-300/15 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <WaluhLogo className="h-8 w-8 rounded-sm shrink-0" />
          <span className="font-display text-sm font-semibold tracking-wider text-white truncate">
            WALUH FAMILY
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white cursor-pointer"
          aria-label="Tutup sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Member Identity Card */}
      <div className="p-4 border-b border-slate-300/15 shrink-0">
        <div className="flex items-center gap-3">
          <MemberAvatar src={user.avatarUrl} name={user.fullName} sizeClass="h-11 w-11 text-xs" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user.fullName}</p>
            <p className="text-xs text-slate-400 truncate">@{user.username}</p>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-400 space-y-0.5">
          <p className="text-slate-200 font-medium truncate">{user.jabatan}</p>
          <p>
            <span className="text-emerald-400">Approved</span> · {user.roleCode}
          </p>
          {user.joinedAt && <p className="text-slate-500">Gabung {formatDateId(user.joinedAt)}</p>}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Portal Anggota
          </p>
          <div className="space-y-0.5">
            {memberLinks.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors cursor-pointer ${
                    active
                      ? 'bg-slate-200 text-black font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {officerLinks.length > 0 && (
          <div>
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Tata Kelola &amp; Pengurus
            </p>
            <div className="space-y-0.5">
              {officerLinks.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors cursor-pointer ${
                      active
                        ? 'bg-slate-200 text-black font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-slate-300/15 shrink-0">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs sm:text-sm text-slate-300 hover:text-white hover:bg-white/[0.05] cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Keluar (Logout)</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050506] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-[272px] max-w-[85vw] h-full">{renderSidebarContent()}</div>
          <div
            className="flex-1 bg-black/75 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-[#050506]/90 backdrop-blur-md border-b border-slate-300/15 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka navigasi dashboard"
              className="lg:hidden p-2 rounded-lg border border-slate-300/20 text-slate-200 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-xs sm:text-sm text-slate-400 truncate">
              <span className="hidden sm:inline">WALUH FAMILY / </span>
              <span className="text-white font-medium">{allTabLabels[activeTab]}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 relative">
            {/* Notifications Bell */}
            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => !v);
                loadNotifications();
              }}
              aria-label="Notifikasi"
              className="relative inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300/20 text-xs text-slate-200 hover:bg-white/5 min-h-[40px] cursor-pointer"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="font-mono font-semibold text-white tabular-nums">{unreadCount}</span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 chrome-surface rounded-xl p-4 shadow-2xl z-50 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-300/15 pb-2">
                  <span className="text-xs font-semibold text-white">Notifikasi Internal</span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markRead()}
                      className="text-xs text-slate-300 hover:text-white underline cursor-pointer"
                    >
                      Tandai semua dibaca
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">Belum ada notifikasi.</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          markRead(n.id);
                          if (n.link_tab && n.link_tab in allTabLabels) {
                            setActiveTab(n.link_tab as DashboardTab);
                          }
                          setNotifOpen(false);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                          n.is_read
                            ? 'bg-[#07080b]/60 border-slate-300/10 text-slate-400'
                            : 'bg-[#12151d] border-slate-300/25 text-slate-100'
                        }`}
                      >
                        <p className="text-xs font-semibold text-white">{n.title}</p>
                        <p className="text-xs mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{formatDateTimeWib(n.created_at)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => selectTab('profile')}
              className="hidden sm:flex items-center gap-2.5 pl-2 pr-3 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <MemberAvatar src={user.avatarUrl} name={user.fullName} sizeClass="h-8 w-8 text-xs" />
              <span className="text-xs font-medium text-slate-200 max-w-[140px] truncate">{user.fullName}</span>
            </button>
          </div>
        </header>

        {/* Active Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && <OverviewView user={user} onNavigate={selectTab} />}
          {activeTab === 'profile' && <MyProfileView user={user} onRefreshUser={onRefreshUser} />}
          {activeTab === 'directory' && <MemberDirectoryView />}
          {activeTab === 'donations' && <DonationTransparencyView />}
          {activeTab === 'my-donations' && <MyDonationHistoryView />}
          {activeTab === 'events' && <EventsView user={user} />}
          {activeTab === 'announcements' && <AnnouncementsView user={user} />}
          {activeTab === 'organization' && <OrganizationStructureView />}
          {activeTab === 'rules' && <CommunityRulesView community={community} />}
          {activeTab === 'settings' && (
            <SettingsView
              user={user}
              community={community}
              onRefreshUser={onRefreshUser}
              onLoggedOut={onLoggedOut}
            />
          )}
          {activeTab === 'treasurer' && <TreasurerDashboardView user={user} />}
          {activeTab === 'registrations' && <RegistrationsAdminView />}
          {activeTab === 'members-admin' && <MembersGovernanceView user={user} />}
          {activeTab === 'roles-admin' && <RolesPermissionsView />}
          {activeTab === 'audit-logs' && <AuditLogsView />}
          {activeTab === 'community-settings' && (
            <CommunitySettingsEditorView community={community} onSaved={onRefreshCommunity} />
          )}
        </main>
      </div>
    </div>
  );
};
