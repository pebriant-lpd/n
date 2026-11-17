import React, { useEffect, useState } from 'react';
import { Download, PlusCircle, RotateCcw, Search, CheckCircle2, AlertCircle, Eye, X } from 'lucide-react';
import {
  apiFetch,
  computeMondaySundayPreview,
  formatCoins,
  formatDateTimeWib,
  getJakartaTodayYmd,
} from '../../lib/api';
import type { UserProfile, WeekPeriod } from '../../types';

interface TreasurerProps {
  user: UserProfile;
}

interface MemberOption {
  id: string;
  full_name: string;
  username: string;
  role_code: string;
  jabatan: string;
}

interface AdjustmentRecord {
  id: string;
  action_type: 'REVERSAL' | 'CORRECTION';
  previous_amount: number;
  new_amount: number;
  reason: string;
  adjusted_by_name: string;
  created_at: string;
}

interface LedgerRow {
  id: string;
  tx_code: string;
  member_id: string;
  member_name: string;
  member_username: string;
  amount_coins: number;
  donation_date: string;
  week_key: string;
  week_start: string;
  week_end: string;
  month_key: string;
  notes: string;
  status: 'VERIFIED' | 'REVERSED';
  treasurer_name: string;
  recorded_at: string;
  adjustments: AdjustmentRecord[];
}

interface LedgerResponse {
  stats: {
    weekTotal: number;
    monthTotal: number;
    allTimeTotal: number;
    verifiedCount: number;
    reversedCount: number;
    currentWeek: WeekPeriod;
    currentMonth: string;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  transactions: LedgerRow[];
}

export const TreasurerDashboardView: React.FC<TreasurerProps> = ({ user }) => {
  const canCreate = user.permissions.includes('donations.create') || user.roleCode === 'CAPSU';
  const canAdjust = user.permissions.includes('donations.adjust') || user.roleCode === 'CAPSU';
  const canExport = user.permissions.includes('donations.export') || user.roleCode === 'CAPSU';

  const [members, setMembers] = useState<MemberOption[]>([]);
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Input form state
  const [memberId, setMemberId] = useState('');
  const [amountCoins, setAmountCoins] = useState('');
  const [donationDate, setDonationDate] = useState(getJakartaTodayYmd());
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingIdempKey, setPendingIdempKey] = useState('');

  // Filter & Pagination state
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  // Detail & Correction modals
  const [detailRow, setDetailRow] = useState<LedgerRow | null>(null);
  const [reverseRow, setReverseRow] = useState<LedgerRow | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [correctionMode, setCorrectionMode] = useState<'REVERSAL' | 'CORRECTION'>('REVERSAL');
  const [correctedAmount, setCorrectedAmount] = useState('');
  const [correctedDate, setCorrectedDate] = useState('');
  const [reversing, setReversing] = useState(false);

  const periodPreview = computeMondaySundayPreview(donationDate);

  const loadData = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: '12',
        status: statusFilter,
      });
      if (search.trim()) qs.set('search', search.trim());
      if (startDate) qs.set('startDate', startDate);
      if (endDate) qs.set('endDate', endDate);

      const [mRes, lRes] = await Promise.all([
        apiFetch<{ members: MemberOption[] }>('/api/treasurer/members'),
        apiFetch<LedgerResponse>(`/api/treasurer/donations?${qs.toString()}`),
      ]);
      setMembers(mRes.members);
      setLedger(lRes);
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memuat data bendahara.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, statusFilter]);

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!memberId) {
      setFeedback({ type: 'error', msg: 'Pilih anggota dari daftar terlebih dahulu.' });
      return;
    }
    const amt = Number(amountCoins);
    if (!Number.isInteger(amt) || amt <= 0) {
      setFeedback({ type: 'error', msg: 'Jumlah donasi koin harus berupa angka bulat positif (> 0).' });
      return;
    }
    if (!periodPreview) {
      setFeedback({ type: 'error', msg: 'Tanggal donasi tidak valid.' });
      return;
    }
    setPendingIdempKey(`${user.id}-${memberId}-${amt}-${donationDate}-${Date.now()}`);
    setConfirmOpen(true);
  };

  const handleConfirmSaveDonation = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/treasurer/donations', {
        method: 'POST',
        body: JSON.stringify({
          memberId,
          amountCoins: Number(amountCoins),
          donationDate,
          notes,
          idempotencyKey: pendingIdempKey,
        }),
      });
      setConfirmOpen(false);
      setAmountCoins('');
      setNotes('');
      setMemberId('');
      setFeedback({ type: 'success', msg: res.message });
      await loadData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menyimpan donasi.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseRow || reversing) return;
    setReversing(true);
    setFeedback(null);
    try {
      const payload: Record<string, unknown> = { reason: reverseReason };
      if (correctionMode === 'CORRECTION') {
        payload.correctedAmountCoins = Number(correctedAmount);
        if (correctedDate) payload.correctedDate = correctedDate;
      }
      const res = await apiFetch<{ message: string }>(`/api/treasurer/donations/${reverseRow.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setReverseRow(null);
      setReverseReason('');
      setCorrectedAmount('');
      setCorrectedDate('');
      setFeedback({ type: 'success', msg: res.message });
      await loadData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memproses koreksi.' });
    } finally {
      setReversing(false);
    }
  };

  const selectedMember = members.find((m) => m.id === memberId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-300/15">
        <div>
          <p className="text-xs tracking-[0.2em] text-slate-400 uppercase mb-1">Operasional Keuangan Resmi</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">
            WALUH FAMILY — TREASURER DASHBOARD
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Setiap donasi terverifikasi otomatis memperbarui halaman Donation Transparency serta rekap mingguan &amp;
            bulanan.
          </p>
        </div>

        {canExport && (
          <a
            href="/api/treasurer/reports/export.csv"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg chrome-btn-secondary text-xs sm:text-sm whitespace-nowrap self-start sm:self-auto"
          >
            <Download className="h-4 w-4" />
            <span>Ekspor Laporan CSV</span>
          </a>
        )}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-2.5 text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/40 border-red-500/40 text-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Treasurer Overview KPIs */}
      {ledger && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="chrome-surface rounded-xl p-5">
            <p className="text-xs text-slate-400 mb-1">Total Minggu Ini ({ledger.stats.currentWeek.weekKey})</p>
            <p className="font-mono text-2xl font-semibold text-white tabular-nums">
              {formatCoins(ledger.stats.weekTotal)} <span className="text-xs font-sans text-slate-400">koin</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">{ledger.stats.currentWeek.weekLabel}</p>
          </div>
          <div className="chrome-surface rounded-xl p-5">
            <p className="text-xs text-slate-400 mb-1">Total Bulan {ledger.stats.currentMonth}</p>
            <p className="font-mono text-2xl font-semibold text-white tabular-nums">
              {formatCoins(ledger.stats.monthTotal)} <span className="text-xs font-sans text-slate-400">koin</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">Berdasarkan tanggal transaksi</p>
          </div>
          <div className="chrome-surface rounded-xl p-5">
            <p className="text-xs text-slate-400 mb-1">Total Keseluruhan</p>
            <p className="font-mono text-2xl font-semibold text-white tabular-nums">
              {formatCoins(ledger.stats.allTimeTotal)} <span className="text-xs font-sans text-slate-400">koin</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">Akumulasi sah sepanjang waktu</p>
          </div>
          <div className="chrome-surface rounded-xl p-5">
            <p className="text-xs text-slate-400 mb-1">Volume Transaksi</p>
            <p className="font-mono text-2xl font-semibold text-white tabular-nums">
              {ledger.stats.verifiedCount}{' '}
              <span className="text-xs font-sans text-slate-400">sah · {ledger.stats.reversedCount} reversal</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">Jejak audit terjaga permanen</p>
          </div>
        </div>
      )}

      {/* A. INPUT DONASI FORM */}
      {canCreate && (
        <section className="chrome-surface rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <PlusCircle className="h-5 w-5 text-slate-200" />
            <h2 className="font-display text-lg font-semibold text-white">Input Donasi Anggota</h2>
          </div>

          <form onSubmit={handleOpenConfirm} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="don-member" className="block text-xs font-medium text-slate-300 mb-1.5">
                Pilih Anggota
              </label>
              <select
                id="don-member"
                required
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white focus:outline-none focus:border-slate-300"
              >
                <option value="">-- Pilih Anggota Terdaftar --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} (@{m.username}) — {m.role_code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="don-amount" className="block text-xs font-medium text-slate-300 mb-1.5">
                Jumlah Donasi (Koin)
              </label>
              <input
                id="don-amount"
                type="number"
                min={1}
                step={1}
                required
                value={amountCoins}
                onChange={(e) => setAmountCoins(e.target.value)}
                placeholder="Contoh: 500"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm font-mono text-white focus:outline-none focus:border-slate-300"
              />
            </div>

            <div>
              <label htmlFor="don-date" className="block text-xs font-medium text-slate-300 mb-1.5">
                Tanggal Transaksi (WIB)
              </label>
              <input
                id="don-date"
                type="date"
                required
                value={donationDate}
                onChange={(e) => setDonationDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm font-mono text-white focus:outline-none focus:border-slate-300"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-300 mb-1.5">Periode Otomatis (Senin–Minggu)</span>
              <div className="px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/15 text-xs font-mono text-slate-200 min-h-[42px] flex items-center">
                {periodPreview ? `${periodPreview.weekKey} (${periodPreview.weekLabel})` : 'Tanggal tidak valid'}
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label htmlFor="don-notes" className="block text-xs font-medium text-slate-300 mb-1.5">
                Catatan Opsional
              </label>
              <input
                id="don-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Donasi mingguan rutin kas keluarga"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white focus:outline-none focus:border-slate-300"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-lg chrome-btn-primary text-sm min-h-[42px] cursor-pointer"
              >
                SIMPAN DONASI
              </button>
            </div>
          </form>
        </section>
      )}

      {/* B. DAFTAR TRANSAKSI */}
      <section className="chrome-surface rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-white">Daftar Transaksi Ledger</h2>
          <p className="text-xs text-slate-400">
            Menghapus permanen dilarang. Gunakan tombol koreksi/reversal untuk mencatat pembetulan audit.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            loadData();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
        >
          <div className="lg:col-span-2 relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama anggota atau ID transaksi..."
              className="w-full pl-10 pr-3.5 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-300"
            />
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Filter tanggal mulai"
            className="px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-xs font-mono text-white"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="Filter tanggal akhir"
            className="px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-xs font-mono text-white"
          />
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-xs text-white"
            >
              <option value="ALL">Semua Status</option>
              <option value="VERIFIED">Verified</option>
              <option value="REVERSED">Reversed</option>
            </select>
            <button type="submit" className="px-3.5 py-2 rounded-lg chrome-btn-primary text-xs cursor-pointer">
              Filter
            </button>
          </div>
        </form>

        {loading ? (
          <div className="h-40 animate-pulse rounded-lg bg-white/[0.02]" />
        ) : !ledger || ledger.transactions.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Belum ada transaksi yang sesuai filter.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-300/15 text-xs text-slate-400">
                    <th className="py-3 pr-3 font-medium">ID Transaksi</th>
                    <th className="py-3 pr-3 font-medium">Anggota</th>
                    <th className="py-3 pr-3 text-right font-medium">Koin</th>
                    <th className="py-3 pr-3 font-medium">Tanggal</th>
                    <th className="py-3 pr-3 font-medium">Periode</th>
                    <th className="py-3 pr-3 font-medium">Pencatat</th>
                    <th className="py-3 pr-3 font-medium">Status</th>
                    <th className="py-3 text-right font-medium">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300/10 text-sm">
                  {ledger.transactions.map((row) => (
                    <tr key={row.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 pr-3 font-mono text-xs text-slate-300 whitespace-nowrap">{row.tx_code}</td>
                      <td className="py-3 pr-3">
                        <span className="font-medium text-white">{row.member_name}</span>
                        <span className="text-xs text-slate-500 ml-1">@{row.member_username}</span>
                      </td>
                      <td className="py-3 pr-3 text-right font-mono font-semibold text-white tabular-nums">
                        {row.status === 'REVERSED' ? (
                          <span className="line-through text-slate-500">{formatCoins(row.amount_coins)}</span>
                        ) : (
                          formatCoins(row.amount_coins)
                        )}
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-slate-300 tabular-nums whitespace-nowrap">
                        {row.donation_date}
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap">
                        {row.week_key}
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-300">{row.treasurer_name}</td>
                      <td className="py-3 pr-3 text-xs font-medium whitespace-nowrap">
                        <span className={row.status === 'VERIFIED' ? 'text-emerald-400' : 'text-red-400'}>
                          {row.status === 'VERIFIED' ? 'Verified' : 'Reversed'}
                        </span>
                      </td>
                      <td className="py-3 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300/20 text-xs text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Detail</span>
                        </button>
                        {canAdjust && row.status === 'VERIFIED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setReverseRow(row);
                              setCorrectionMode('REVERSAL');
                              setCorrectedAmount(String(row.amount_coins));
                              setCorrectedDate(row.donation_date);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-amber-500/30 text-xs text-amber-300 hover:bg-amber-950/40 cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Koreksi</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-300/10 text-xs text-slate-400">
              <span className="tabular-nums">
                Halaman {ledger.pagination.page} dari {ledger.pagination.totalPages} ({ledger.pagination.total} transaksi)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded chrome-btn-secondary disabled:opacity-40 cursor-pointer"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={page >= ledger.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded chrome-btn-secondary disabled:opacity-40 cursor-pointer"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Confirmation Modal before saving donation */}
      {confirmOpen && selectedMember && periodPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="chrome-surface rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold text-white">Konfirmasi Penyimpanan Donasi</h3>
            <div className="space-y-2 text-sm text-slate-300 bg-[#07080b] p-4 rounded-lg border border-slate-300/15">
              <p>
                <span className="text-slate-400">Anggota:</span>{' '}
                <span className="text-white font-medium">{selectedMember.full_name}</span>
              </p>
              <p>
                <span className="text-slate-400">Jumlah:</span>{' '}
                <span className="text-white font-mono font-semibold">{formatCoins(Number(amountCoins))} koin</span>
              </p>
              <p>
                <span className="text-slate-400">Tanggal:</span>{' '}
                <span className="font-mono text-white">{donationDate}</span>
              </p>
              <p>
                <span className="text-slate-400">Periode Minggu:</span>{' '}
                <span className="font-mono text-white">{periodPreview.weekKey}</span>
              </p>
              {notes && (
                <p>
                  <span className="text-slate-400">Catatan:</span> {notes}
                </p>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Setelah disimpan, transaksi ini langsung terpublikasi ke halaman Donation Transparency.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm rounded-lg chrome-btn-secondary cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmSaveDonation}
                className="px-4 py-2 text-sm rounded-lg chrome-btn-primary cursor-pointer"
              >
                {submitting ? 'Menyimpan...' : 'Ya, Simpan Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailRow && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="chrome-surface rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-300/15 pb-3">
              <h3 className="font-display text-lg font-semibold text-white">Detail Transaksi {detailRow.tx_code}</h3>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Anggota: <span className="text-white font-medium">{detailRow.member_name} (@{detailRow.member_username})</span></p>
              <p>Jumlah: <span className="font-mono text-white font-semibold">{formatCoins(detailRow.amount_coins)} koin</span></p>
              <p>Tanggal Donasi: <span className="font-mono text-white">{detailRow.donation_date}</span></p>
              <p>Periode Minggu: <span className="font-mono text-white">{detailRow.week_key} ({detailRow.week_start} s/d {detailRow.week_end})</span></p>
              <p>Waktu Pencatatan: <span className="text-white">{formatDateTimeWib(detailRow.recorded_at)}</span></p>
              <p>Bendahara Pencatat: <span className="text-white">{detailRow.treasurer_name}</span></p>
              <p>Catatan: <span className="text-white">{detailRow.notes || '—'}</span></p>
            </div>
            {detailRow.adjustments && detailRow.adjustments.length > 0 && (
              <div className="pt-3 border-t border-slate-300/15 space-y-2">
                <p className="text-xs font-semibold text-amber-300">Riwayat Koreksi / Reversal</p>
                {detailRow.adjustments.map((a) => (
                  <div key={a.id} className="text-xs bg-[#07080b] p-3 rounded-lg border border-slate-300/10 space-y-1">
                    <p className="text-white font-medium">
                      {a.action_type} · {formatCoins(a.previous_amount)} → {formatCoins(a.new_amount)} koin
                    </p>
                    <p className="text-slate-300">Alasan: {a.reason}</p>
                    <p className="text-slate-500">
                      Oleh {a.adjusted_by_name} · {formatDateTimeWib(a.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reversal / Correction Modal */}
      {reverseRow && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="chrome-surface rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-300/15 pb-3">
              <h3 className="font-display text-lg font-semibold text-white">
                Koreksi / Reversal {reverseRow.tx_code}
              </h3>
              <button
                type="button"
                onClick={() => setReverseRow(null)}
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleReverseSubmit} className="space-y-4">
              <div className="flex gap-2 p-1 rounded-lg bg-[#07080b] border border-slate-300/15">
                <button
                  type="button"
                  onClick={() => setCorrectionMode('REVERSAL')}
                  className={`flex-1 py-2 text-xs rounded-md font-medium cursor-pointer ${
                    correctionMode === 'REVERSAL' ? 'bg-slate-200 text-black' : 'text-slate-400'
                  }`}
                >
                  Batalkan (Reversal)
                </button>
                <button
                  type="button"
                  onClick={() => setCorrectionMode('CORRECTION')}
                  className={`flex-1 py-2 text-xs rounded-md font-medium cursor-pointer ${
                    correctionMode === 'CORRECTION' ? 'bg-slate-200 text-black' : 'text-slate-400'
                  }`}
                >
                  Reversal + Nilai Pengganti
                </button>
              </div>

              {correctionMode === 'CORRECTION' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Jumlah Koin Benar</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={correctedAmount}
                      onChange={(e) => setCorrectedAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Tanggal Benar</label>
                    <input
                      type="date"
                      required
                      value={correctedDate}
                      onChange={(e) => setCorrectedDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm font-mono text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-300 mb-1">Alasan Koreksi (Wajib untuk Audit Log)</label>
                <textarea
                  rows={3}
                  required
                  minLength={5}
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder="Jelaskan alasan koreksi transaksi secara jelas..."
                  className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReverseRow(null)}
                  className="px-4 py-2 text-sm rounded-lg chrome-btn-secondary cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={reversing}
                  className="px-4 py-2 text-sm rounded-lg chrome-btn-primary cursor-pointer"
                >
                  {reversing ? 'Memproses...' : 'Simpan Koreksi Audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
