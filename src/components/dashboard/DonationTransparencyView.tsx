import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, Coins } from 'lucide-react';
import { apiFetch, formatCoins, formatDateId, formatDateTimeWib } from '../../lib/api';
import type { DonationTransparencyResponse, WeekPeriod } from '../../types';
import { MemberAvatar } from '../WaluhLogo';

export const DonationTransparencyView: React.FC = () => {
  const [data, setData] = useState<DonationTransparencyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [subTab, setSubTab] = useState<'ledger' | 'members' | 'weekly' | 'monthly'>('ledger');

  const loadData = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (weekFilter) qs.set('weekKey', weekFilter);
      if (monthFilter) qs.set('monthKey', monthFilter);
      if (search.trim()) qs.set('search', search.trim());
      const res = await apiFetch<DonationTransparencyResponse>(`/api/donations/transparency?${qs.toString()}`);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat transparansi donasi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [weekFilter, monthFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-300/15">
        <div>
          <p className="text-xs tracking-[0.2em] text-slate-400 uppercase mb-1">
            Transparansi Keuangan Komunitas
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">
            DONATION TRANSPARENCY
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Seluruh transaksi terverifikasi dari Bendahara otomatis tampil secara terbuka tanpa data pribadi sensitif.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm rounded-lg chrome-btn-secondary whitespace-nowrap self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-sm text-red-200">{error}</div>
      )}

      {data && (
        <>
          {/* Active Monday-Sunday Period Notice */}
          <div className="chrome-surface rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400">Periode Mingguan Aktif (Senin – Minggu · Asia/Jakarta)</p>
              <p className="font-display text-lg font-semibold text-white mt-0.5">
                {data.currentWeek.weekKey} · {data.currentWeek.weekLabel}
              </p>
            </div>
            <p className="text-xs text-slate-400 max-w-md">
              Reset mingguan berlangsung otomatis setiap hari Senin pukul 00:00 WIB tanpa menghapus riwayat transaksi
              minggu sebelumnya.
            </p>
          </div>

          {/* 4 KPI Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="chrome-surface rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1.5">Total Minggu Berjalan</p>
              <p className="font-mono text-2xl font-semibold text-white tabular-nums">
                {formatCoins(data.totals.currentWeekTotal)}{' '}
                <span className="text-xs font-sans text-slate-400">koin</span>
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono">{data.currentWeek.weekKey}</p>
            </div>
            <div className="chrome-surface rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1.5">Total Bulan {data.currentMonth}</p>
              <p className="font-mono text-2xl font-semibold text-white tabular-nums">
                {formatCoins(data.totals.currentMonthTotal)}{' '}
                <span className="text-xs font-sans text-slate-400">koin</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Akumulasi tanggal transaksi bulan ini</p>
            </div>
            <div className="chrome-surface rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1.5">Total Sepanjang Waktu</p>
              <p className="font-mono text-2xl font-semibold text-white tabular-nums">
                {formatCoins(data.totals.allTimeTotal)}{' '}
                <span className="text-xs font-sans text-slate-400">koin</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Seluruh transaksi terverifikasi</p>
            </div>
            <div className="chrome-surface rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1.5">Jumlah Transaksi Sah</p>
              <p className="font-mono text-2xl font-semibold text-white tabular-nums">
                {data.totals.transactionCount}
              </p>
              <p className="text-xs text-slate-500 mt-1">Sumber data tunggal teraudit</p>
            </div>
          </div>

          {/* Sub-View Switcher */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#090a0d] border border-slate-300/15 rounded-lg w-fit">
            {[
              { id: 'ledger', label: 'Daftar Transaksi' },
              { id: 'members', label: 'Rekap Per Anggota' },
              { id: 'weekly', label: 'Riwayat Mingguan' },
              { id: 'monthly', label: 'Rekap Bulanan' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id as typeof subTab)}
                className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  subTab === t.id ? 'bg-slate-200 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* SUBTAB 1: VERIFIED LEDGER */}
          {subTab === 'ledger' && (
            <div className="chrome-surface rounded-xl p-6 space-y-5">
              <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2 relative">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama anggota atau ID transaksi..."
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-300"
                  />
                </div>
                <select
                  value={weekFilter}
                  onChange={(e) => setWeekFilter(e.target.value)}
                  className="px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white focus:outline-none focus:border-slate-300"
                >
                  <option value="">Semua Periode Minggu</option>
                  {data.weeklyHistory.map((w) => (
                    <option key={w.weekKey} value={w.weekKey}>
                      {w.weekKey} ({w.weekStart} s/d {w.weekEnd})
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white focus:outline-none focus:border-slate-300"
                  >
                    <option value="">Semua Bulan</option>
                    {data.monthlyHistory.map((m) => (
                      <option key={m.monthKey} value={m.monthKey}>
                        {m.monthKey}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="px-4 py-2.5 rounded-lg chrome-btn-primary text-xs cursor-pointer">
                    Cari
                  </button>
                </div>
              </form>

              {data.transactions.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Coins className="h-8 w-8 text-slate-600 mx-auto" />
                  <p className="text-sm text-slate-300 font-medium">Belum ada transaksi donasi terverifikasi</p>
                  <p className="text-xs text-slate-500">
                    Transaksi yang dicatat oleh Bendahara akan langsung muncul secara otomatis di sini.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300/15 text-xs text-slate-400">
                        <th className="py-3 pr-4 font-medium">ID Transaksi</th>
                        <th className="py-3 pr-4 font-medium">Nama Anggota</th>
                        <th className="py-3 pr-4 font-medium">Tanggal Donasi</th>
                        <th className="py-3 pr-4 font-medium">Periode Minggu</th>
                        <th className="py-3 pr-4 font-medium">Catatan</th>
                        <th className="py-3 text-right font-medium">Jumlah Koin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300/10 text-sm">
                      {data.transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-white/[0.02]">
                          <td className="py-3.5 pr-4 font-mono text-xs text-slate-300 whitespace-nowrap">{tx.txCode}</td>
                          <td className="py-3.5 pr-4">
                            <span className="font-medium text-white">{tx.memberName}</span>
                            <span className="text-xs text-slate-500 ml-1.5">@{tx.memberUsername}</span>
                          </td>
                          <td className="py-3.5 pr-4 font-mono text-xs text-slate-300 tabular-nums whitespace-nowrap">
                            {formatDateId(tx.donationDate)}
                          </td>
                          <td className="py-3.5 pr-4 font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap">
                            {tx.weekKey}
                          </td>
                          <td className="py-3.5 pr-4 text-xs text-slate-400 max-w-xs truncate">
                            {tx.notes || '—'}
                          </td>
                          <td className="py-3.5 text-right font-mono font-semibold text-white tabular-nums whitespace-nowrap">
                            +{formatCoins(tx.amountCoins)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 2: MEMBER RECAP */}
          {subTab === 'members' && (
            <div className="chrome-surface rounded-xl p-6">
              <h2 className="font-display text-lg font-semibold text-white mb-4">Rekapitulasi Donasi Per Anggota</h2>
              {data.memberRecap.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">Belum ada data rekap anggota.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300/15 text-xs text-slate-400">
                        <th className="py-3 pr-4 font-medium">Anggota</th>
                        <th className="py-3 pr-4 text-right font-medium">Minggu Ini</th>
                        <th className="py-3 pr-4 text-right font-medium">Bulan Ini</th>
                        <th className="py-3 pr-4 text-right font-medium">Total Keseluruhan</th>
                        <th className="py-3 text-right font-medium">Transaksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300/10 text-sm">
                      {data.memberRecap.map((m) => (
                        <tr key={m.memberId} className="hover:bg-white/[0.02]">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <MemberAvatar src={m.memberAvatar} name={m.memberName} sizeClass="h-8 w-8 text-xs" />
                              <div>
                                <p className="font-medium text-white">{m.memberName}</p>
                                <p className="text-xs text-slate-500">@{m.memberUsername}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right font-mono text-slate-200 tabular-nums">
                            {formatCoins(m.currentWeekCoins)}
                          </td>
                          <td className="py-3 pr-4 text-right font-mono text-slate-200 tabular-nums">
                            {formatCoins(m.currentMonthCoins)}
                          </td>
                          <td className="py-3 pr-4 text-right font-mono font-semibold text-white tabular-nums">
                            {formatCoins(m.allTimeCoins)}
                          </td>
                          <td className="py-3 text-right font-mono text-slate-400 tabular-nums">{m.txCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 3: WEEKLY HISTORY */}
          {subTab === 'weekly' && (
            <div className="chrome-surface rounded-xl p-6">
              <h2 className="font-display text-lg font-semibold text-white mb-4">
                Riwayat Periode Mingguan (Senin – Minggu)
              </h2>
              {data.weeklyHistory.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">Belum ada riwayat mingguan.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300/15 text-xs text-slate-400">
                        <th className="py-3 pr-4 font-medium">Periode</th>
                        <th className="py-3 pr-4 font-medium">Rentang Senin – Minggu</th>
                        <th className="py-3 pr-4 text-right font-medium">Transaksi</th>
                        <th className="py-3 text-right font-medium">Total Koin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300/10 text-sm">
                      {data.weeklyHistory.map((w) => (
                        <tr key={w.weekKey} className="hover:bg-white/[0.02]">
                          <td className="py-3 pr-4 font-mono text-white font-medium">{w.weekKey}</td>
                          <td className="py-3 pr-4 text-slate-300 font-mono text-xs tabular-nums">
                            {w.weekStart} s/d {w.weekEnd}
                          </td>
                          <td className="py-3 pr-4 text-right font-mono text-slate-400 tabular-nums">{w.txCount}</td>
                          <td className="py-3 text-right font-mono font-semibold text-white tabular-nums">
                            {formatCoins(w.totalCoins)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 4: MONTHLY RECAP */}
          {subTab === 'monthly' && (
            <div className="chrome-surface rounded-xl p-6">
              <h2 className="font-display text-lg font-semibold text-white mb-2">Rekapitulasi Bulanan</h2>
              <p className="text-xs text-slate-400 mb-4">
                Dihitung akurat berdasarkan tanggal transaksi masing-masing (transaksi lintas-bulan tetap masuk ke bulan
                tanggal transaksinya).
              </p>
              {data.monthlyHistory.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">Belum ada rekap bulanan.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300/15 text-xs text-slate-400">
                        <th className="py-3 pr-4 font-medium">Bulan</th>
                        <th className="py-3 pr-4 text-right font-medium">Jumlah Transaksi</th>
                        <th className="py-3 text-right font-medium">Total Koin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300/10 text-sm">
                      {data.monthlyHistory.map((m) => (
                        <tr key={m.monthKey} className="hover:bg-white/[0.02]">
                          <td className="py-3 pr-4 font-mono text-white font-medium">{m.monthKey}</td>
                          <td className="py-3 pr-4 text-right font-mono text-slate-400 tabular-nums">{m.txCount}</td>
                          <td className="py-3 text-right font-mono font-semibold text-white tabular-nums">
                            {formatCoins(m.totalCoins)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const MyDonationHistoryView: React.FC = () => {
  const [data, setData] = useState<{
    summary: { weekCoins: number; monthCoins: number; totalCoins: number; currentWeek: WeekPeriod; currentMonth: string };
    history: Array<{
      id: string;
      tx_code: string;
      amount_coins: number;
      donation_date: string;
      week_key: string;
      notes: string;
      status: string;
      recorded_at: string;
      treasurer_name: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<NonNullable<typeof data>>('/api/donations/my')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="chrome-surface rounded-xl p-6 h-48 animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-slate-300/15">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Catatan Pribadi</p>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">Donation History</h1>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="chrome-surface rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1">Donasi Minggu Ini ({data.summary.currentWeek.weekKey})</p>
              <p className="font-mono text-2xl font-semibold text-white tabular-nums">
                {formatCoins(data.summary.weekCoins)} koin
              </p>
            </div>
            <div className="chrome-surface rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1">Donasi Bulan {data.summary.currentMonth}</p>
              <p className="font-mono text-2xl font-semibold text-white tabular-nums">
                {formatCoins(data.summary.monthCoins)} koin
              </p>
            </div>
            <div className="chrome-surface rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1">Total Kontribusi Pribadi</p>
              <p className="font-mono text-2xl font-semibold text-white tabular-nums">
                {formatCoins(data.summary.totalCoins)} koin
              </p>
            </div>
          </div>

          <div className="chrome-surface rounded-xl p-6">
            {data.history.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                Anda belum memiliki riwayat donasi tercatat.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300/15 text-xs text-slate-400">
                      <th className="py-3 pr-4 font-medium">ID Transaksi</th>
                      <th className="py-3 pr-4 font-medium">Tanggal</th>
                      <th className="py-3 pr-4 font-medium">Periode</th>
                      <th className="py-3 pr-4 font-medium">Dicatat Oleh</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 text-right font-medium">Koin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300/10 text-sm">
                    {data.history.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-300">{tx.tx_code}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-300 tabular-nums">{tx.donation_date}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-400 tabular-nums">{tx.week_key}</td>
                        <td className="py-3 pr-4 text-xs text-slate-300">{tx.treasurer_name}</td>
                        <td className="py-3 pr-4 text-xs">
                          <span className={tx.status === 'VERIFIED' ? 'text-emerald-400' : 'text-red-400 line-through'}>
                            {tx.status === 'VERIFIED' ? 'Verified' : 'Reversed'}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono font-semibold text-white tabular-nums">
                          {tx.status === 'REVERSED' ? (
                            <span className="line-through text-slate-500">{formatCoins(tx.amount_coins)}</span>
                          ) : (
                            `+${formatCoins(tx.amount_coins)}`
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-slate-500 mt-4">
                  Catatan waktu pencatatan: {formatDateTimeWib(data.history[0]?.recorded_at)}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
