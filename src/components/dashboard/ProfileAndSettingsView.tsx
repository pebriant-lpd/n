import React, { useEffect, useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, LogOut, ShieldAlert } from 'lucide-react';
import { apiFetch, fileToCompressedAvatarDataUrl, formatDateId, formatDateTimeWib } from '../../lib/api';
import type { CommunityInfo, UserProfile } from '../../types';
import { MemberAvatar } from '../WaluhLogo';

export const MyProfileView: React.FC<{ user: UserProfile; onRefreshUser: () => Promise<void> }> = ({
  user,
  onRefreshUser,
}) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [additionalInfo, setAdditionalInfo] = useState(user.additionalInfo);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({ fullName, username, bio, additionalInfo, avatarUrl }),
      });
      await onRefreshUser();
      setFeedback({ type: 'success', msg: res.message });
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memperbarui profil.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="pb-5 border-b border-slate-300/15">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Identitas Anggota</p>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">My Profile</h1>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2 text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/40 border-red-500/40 text-red-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="chrome-surface rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-5 border-b border-slate-300/10">
          <MemberAvatar src={avatarUrl} name={fullName || user.fullName} sizeClass="h-16 w-16 text-lg" />
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              {user.roleName} · {user.jabatan} · Bergabung {formatDateId(user.joinedAt)}
            </p>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg chrome-btn-secondary text-xs cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>Ubah Foto Profil</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      try {
                        setAvatarUrl(await fileToCompressedAvatarDataUrl(f));
                      } catch (err: unknown) {
                        setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memuat foto.' });
                      }
                    }
                  }}
                  className="hidden"
                />
              </label>
              {avatarUrl && (
                <button type="button" onClick={() => setAvatarUrl('')} className="text-xs text-slate-400 hover:text-white cursor-pointer">
                  Hapus Foto
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Nama Lengkap</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Bio Singkat</label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Perkenalkan diri Anda kepada keluarga WALUH..."
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Informasi Tambahan (Kontak / Catatan)</label>
          <input
            type="text"
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
          />
        </div>

        <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-lg chrome-btn-primary text-sm cursor-pointer">
          {saving ? 'Menyimpan...' : 'Simpan Profil Saya'}
        </button>
      </form>
    </div>
  );
};

export const CommunityRulesView: React.FC<{ community: CommunityInfo }> = ({ community }) => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-5 border-b border-slate-300/15">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Kode Etik &amp; Pedoman</p>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">Community Rules &amp; Vision</h1>
      </div>

      <div className="chrome-surface rounded-xl p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-white">Visi WALUH FAMILY</h2>
        <p className="text-sm text-slate-300 leading-relaxed">{community.vision}</p>
        <h3 className="font-display text-base font-semibold text-white pt-2">Misi</h3>
        <ol className="space-y-2 text-sm text-slate-300">
          {community.mission.map((m, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono text-slate-400">0{i + 1}.</span>
              <span>{m}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="chrome-surface rounded-xl p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-white">Aturan Resmi Keluarga</h2>
        <ol className="space-y-3 text-sm text-slate-300">
          {community.rules.map((r, i) => (
            <li key={i} className="flex gap-3 pb-3 border-b border-slate-300/10 last:border-b-0 last:pb-0">
              <span className="font-mono text-slate-400 shrink-0">0{i + 1}.</span>
              <span className="leading-relaxed">{r}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

interface SessionRow {
  id: string;
  userAgent: string;
  ipAddress: string;
  rememberMe: boolean;
  expiresAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export const SettingsView: React.FC<{
  user: UserProfile;
  community: CommunityInfo;
  onRefreshUser: () => Promise<void>;
  onLoggedOut: () => void;
}> = ({ user, community, onRefreshUser, onLoggedOut }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [privacyJoined, setPrivacyJoined] = useState(user.privacyShowJoined);
  const [privacyDonations, setPrivacyDonations] = useState(user.privacyShowDonations);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [delPassword, setDelPassword] = useState('');
  const [delPhrase, setDelPhrase] = useState('');
  const [delStepOpen, setDelStepOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadSessions = async () => {
    const res = await apiFetch<{ sessions: SessionRow[] }>('/api/sessions');
    setSessions(res.sessions);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/profile/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setFeedback({ type: 'success', msg: res.message });
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal mengubah password.' });
    }
  };

  const handlePrivacySave = async () => {
    setFeedback(null);
    try {
      await apiFetch('/api/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({ privacyShowJoined: privacyJoined, privacyShowDonations: privacyDonations }),
      });
      await onRefreshUser();
      setFeedback({ type: 'success', msg: 'Pengaturan privasi disimpan.' });
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menyimpan privasi.' });
    }
  };

  const handleRevokeAll = async () => {
    await apiFetch('/api/sessions/revoke-all', { method: 'POST' });
    onLoggedOut();
  };

  const handleAccountDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await apiFetch('/api/profile/request-deletion', {
        method: 'POST',
        body: JSON.stringify({ password: delPassword, confirmationPhrase: delPhrase }),
      });
      onLoggedOut();
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memproses permintaan.' });
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="pb-5 border-b border-slate-300/15">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Keamanan &amp; Preferensi</p>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">Account Settings</h1>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2 text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/40 border-red-500/40 text-red-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Change Password */}
      <form onSubmit={handlePasswordChange} className="chrome-surface rounded-xl p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-white">Ubah Password</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Password Saat Ini</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Password Baru (min. 8 karakter)</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
            />
          </div>
        </div>
        <button type="submit" className="px-5 py-2 rounded-lg chrome-btn-primary text-sm cursor-pointer">
          Perbarui Password
        </button>
      </form>

      {/* Privacy Controls */}
      <div className="chrome-surface rounded-xl p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-white">Pengaturan Privasi Direktori</h2>
        <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={privacyJoined}
            onChange={(e) => setPrivacyJoined(e.target.checked)}
            className="rounded border-slate-500 bg-[#07080b]"
          />
          <span>Tampilkan tanggal bergabung di Member Directory</span>
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={privacyDonations}
            onChange={(e) => setPrivacyDonations(e.target.checked)}
            className="rounded border-slate-500 bg-[#07080b]"
          />
          <span>Tampilkan nama saya pada rekap transparansi donasi</span>
        </label>
        <button type="button" onClick={handlePrivacySave} className="px-5 py-2 rounded-lg chrome-btn-secondary text-sm cursor-pointer">
          Simpan Preferensi Privasi
        </button>
      </div>

      {/* Sessions Management */}
      <div className="chrome-surface rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-white">Sesi Perangkat Aktif</h2>
          <button
            type="button"
            onClick={handleRevokeAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-500/40 text-xs text-red-300 hover:bg-red-950/40 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Logout Dari Semua Perangkat</span>
          </button>
        </div>

        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="p-3 rounded-lg bg-[#07080b] border border-slate-300/10 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-slate-200 truncate">
                  {s.isCurrent ? 'Perangkat Ini · ' : ''}
                  {s.userAgent || 'Browser Session'}
                </p>
                <p className="text-slate-500">
                  IP: {s.ipAddress || 'local'} · Aktif: {formatDateTimeWib(s.lastActiveAt)}
                </p>
              </div>
              <span className="text-slate-400 shrink-0">{s.rememberMe ? '30 Hari' : '24 Jam'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Layered Account Deletion */}
      <div className="chrome-surface rounded-xl p-6 space-y-4 border-red-500/20">
        <div className="flex items-center gap-2 text-red-300">
          <ShieldAlert className="h-5 w-5" />
          <h2 className="font-display text-lg font-semibold">Penonaktifan &amp; Penghapusan Akun</h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{community.retentionPolicy}</p>

        {!delStepOpen ? (
          <button
            type="button"
            onClick={() => setDelStepOpen(true)}
            className="px-4 py-2 rounded-lg border border-red-500/40 text-xs text-red-300 hover:bg-red-950/40 cursor-pointer"
          >
            Ajukan Penghapusan Akun
          </button>
        ) : (
          <form onSubmit={handleAccountDeletion} className="space-y-3 pt-2">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Konfirmasi Password</label>
              <input
                type="password"
                required
                value={delPassword}
                onChange={(e) => setDelPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-red-500/30 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Ketik tepat: <span className="font-mono text-white">HAPUS AKUN SAYA</span>
              </label>
              <input
                type="text"
                required
                value={delPhrase}
                onChange={(e) => setDelPhrase(e.target.value)}
                placeholder="HAPUS AKUN SAYA"
                className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-red-500/30 text-sm font-mono text-white"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDelStepOpen(false)}
                className="px-4 py-2 rounded-lg chrome-btn-secondary text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                Konfirmasi Nonaktifkan Akun
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
