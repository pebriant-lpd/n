import React, { useEffect, useState } from 'react';
import { ArrowRight, Calendar, Coins, Megaphone, Users, ShieldCheck } from 'lucide-react';
import { apiFetch, formatCoins, formatDateId, formatDateTimeWib } from '../../lib/api';
import type { DashboardTab, UserProfile, WeekPeriod } from '../../types';

interface OverviewViewProps {
  user: UserProfile;
  onNavigate: (tab: DashboardTab) => void;
}

interface SummaryPayload {
  activeMembers: number;
  pendingRegistrations: number;
  currentWeek: WeekPeriod;
  currentMonth: string;
  donations: {
    weekTotal: number;
    monthTotal: number;
    allTimeTotal: number;
    myTotal: number;
  };
  latestAnnouncements: Array<{
    id: string;
    title: string;
    content: string;
    published_at: string;
    author_name: string;
  }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    event_date: string;
    event_time: string;
    location: string;
    status: string;
  }>;
  recentDonations: Array<{
    id: string;
    tx_code: string;
    amount_coins: number;
    donation_date: string;
    week_key: string;
    recorded_at: string;
    member_name: string;
    member_username: string;
  }>;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ user, onNavigate }) => {
  const [data, setData] = useState<SummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<SummaryPayload>('/api/dashboard/summary')
      .then((res) => {
        if (active) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Gagal memuat ringkasan.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="chrome-surface rounded-xl p-5 h-28 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="chrome-surface rounded-xl p-6 h-64 animate-pulse" />
          <div className="chrome-surface rounded-xl p-6 h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="chrome-surface rounded-xl p-6 text-sm text-red-300">
        {error || 'Ringkasan dashboard tidak tersedia.'}
      </div>
    );
  }

  const canReviewRegs = user.permissions.includes('registrations.review') || user.roleCode === 'CAPSU';
  const canCreateDonation = user.permissions.includes('donations.create') || user.roleCode === 'CAPSU';

  return (
    <div className="space-y-8">
      {/* Header Welcome Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-300/15">
        <div>
          <p className="text-xs text-slate-400 tracking-wide mb-1">
            {user.roleName} · {user.jabatan}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">
            Selamat Datang, {user.fullName}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canReviewRegs && data.pendingRegistrations > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('registrations')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm rounded-lg chrome-btn-secondary whitespace-nowrap cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <span className="tabular-nums">{data.pendingRegistrations} Pendaftaran Menunggu</span>
            </button>
          )}
          {canCreateDonation && (
            <button
              type="button"
              onClick={() => onNavigate('treasurer')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm rounded-lg chrome-btn-primary whitespace-nowrap cursor-pointer"
            >
              <Coins className="h-4 w-4" />
              <span>Input Donasi</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="chrome-surface rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Anggota Aktif</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <p className="font-mono text-2xl font-semibold text-white tabular-nums">{data.activeMembers}</p>
          <p className="text-xs text-slate-500 mt-1">Status terverifikasi penuh</p>
        </div>

        <div className="chrome-surface rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Donasi Minggu Ini</span>
            <Coins className="h-4 w-4 text-slate-400" />
          </div>
          <p className="font-mono text-2xl font-semibold text-white tabular-nums">
            {formatCoins(data.donations.weekTotal)} <span className="text-xs font-sans text-slate-400">koin</span>
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            {data.currentWeek.weekKey} · {data.currentWeek.weekLabel}
          </p>
        </div>

        <div className="chrome-surface rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Donasi Bulan {data.currentMonth}</span>
            <Coins className="h-4 w-4 text-slate-400" />
          </div>
          <p className="font-mono text-2xl font-semibold text-white tabular-nums">
            {formatCoins(data.donations.monthTotal)} <span className="text-xs font-sans text-slate-400">koin</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Berdasarkan tanggal transaksi</p>
        </div>

        <div className="chrome-surface rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Total Sepanjang Waktu</span>
            <Coins className="h-4 w-4 text-slate-400" />
          </div>
          <p className="font-mono text-2xl font-semibold text-white tabular-nums">
            {formatCoins(data.donations.allTimeTotal)} <span className="text-xs font-sans text-slate-400">koin</span>
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            Kontribusi Anda: {formatCoins(data.donations.myTotal)} koin
          </p>
        </div>
      </div>

      {/* Announcements & Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="chrome-surface rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-slate-300" />
                <h2 className="font-display text-lg font-semibold text-white">Pengumuman Terbaru</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('announcements')}
                className="text-xs text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Lihat semua</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {data.latestAnnouncements.length === 0 ? (
              <p className="text-sm text-slate-500 py-6">Belum ada pengumuman yang diterbitkan.</p>
            ) : (
              <div className="space-y-4">
                {data.latestAnnouncements.map((ann) => (
                  <article key={ann.id} className="pb-4 border-b border-slate-300/10 last:border-b-0 last:pb-0">
                    <h3 className="text-sm font-semibold text-white mb-1">{ann.title}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-1.5">{ann.content}</p>
                    <p className="text-xs text-slate-500">
                      {ann.author_name} · {formatDateTimeWib(ann.published_at)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="chrome-surface rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-300" />
                <h2 className="font-display text-lg font-semibold text-white">Event Mendatang</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('events')}
                className="text-xs text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Lihat semua</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {data.upcomingEvents.length === 0 ? (
              <p className="text-sm text-slate-500 py-6">Belum ada agenda event aktif saat ini.</p>
            ) : (
              <div className="space-y-4">
                {data.upcomingEvents.map((ev) => (
                  <div key={ev.id} className="pb-4 border-b border-slate-300/10 last:border-b-0 last:pb-0 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{ev.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDateId(ev.event_date)}
                        {ev.event_time ? ` · ${ev.event_time}` : ''} · {ev.location}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-300 shrink-0">{ev.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Recent Verified Donations */}
      <section className="chrome-surface rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">Aktivitas Donasi Terverifikasi Terbaru</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Otomatis tersinkronisasi dari pencatatan Bendahara
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('donations')}
            className="text-xs text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Buka Transparansi</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {data.recentDonations.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Belum ada transaksi donasi tercatat. Transaksi yang disimpan Bendahara akan tampil otomatis di sini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-300/15 text-xs text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">ID Transaksi</th>
                  <th className="py-2.5 pr-4 font-medium">Anggota</th>
                  <th className="py-2.5 pr-4 font-medium">Tanggal</th>
                  <th className="py-2.5 pr-4 font-medium">Periode</th>
                  <th className="py-2.5 text-right font-medium">Jumlah Koin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300/10 text-sm">
                {data.recentDonations.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 pr-4 font-mono text-xs text-slate-300">{tx.tx_code}</td>
                    <td className="py-3 pr-4">
                      <span className="text-white font-medium">{tx.member_name}</span>
                      <span className="text-xs text-slate-500 ml-2">@{tx.member_username}</span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-300 tabular-nums">{tx.donation_date}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-400 tabular-nums">{tx.week_key}</td>
                    <td className="py-3 text-right font-mono font-semibold text-white tabular-nums">
                      +{formatCoins(tx.amount_coins)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
