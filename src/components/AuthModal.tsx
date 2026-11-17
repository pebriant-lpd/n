import React, { useState } from 'react';
import { X, Eye, EyeOff, Upload, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { apiFetch, fileToCompressedAvatarDataUrl } from '../lib/api';
import type { UserProfile } from '../types';
import { WaluhLogo } from './WaluhLogo';

interface AuthModalProps {
  initialMode: 'login' | 'register';
  rules: string[];
  onClose: () => void;
  onSuccessLogin: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ initialMode, rules, onClose, onSuccessLogin }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPass, setShowPass] = useState(false);

  // Register state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [showRulesDrawer, setShowRulesDrawer] = useState(false);

  // Forgot / Reset state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, rememberMe }),
      });
      onSuccessLogin(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login gagal.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ message: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          username,
          email,
          password: regPassword,
          avatarUrl,
          additionalInfo,
          rulesAccepted,
        }),
      });
      setSuccessMsg(data.message);
      setFullName('');
      setUsername('');
      setEmail('');
      setRegPassword('');
      setAdditionalInfo('');
      setAvatarUrl('');
      setRulesAccepted(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Pendaftaran gagal.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ message: string; resetTokenPreview?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });
      setSuccessMsg(data.message);
      if (data.resetTokenPreview) {
        setResetToken(data.resetTokenPreview);
      }
      setMode('reset');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal meminta reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      setSuccessMsg(data.message);
      setMode('login');
      setResetToken('');
      setNewPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mereset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await fileToCompressedAvatarDataUrl(file);
      setAvatarUrl(compressed);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memproses foto profil.');
    }
  };

  const fillCapsuStarter = () => {
    setIdentifier('capsu@waluhfamily.org');
    setPassword('WaluhCapsu#2026');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="chrome-surface rounded-2xl max-w-lg w-full p-6 sm:p-8 my-8 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup jendela autentikasi"
          className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 pr-10">
          <WaluhLogo className="h-11 w-11 rounded" />
          <div>
            <h2 className="font-display text-xl font-semibold text-white">WALUH FAMILY</h2>
            <p className="text-xs text-slate-400">WELLBORN FAMILY · Portal Anggota</p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1 p-1 bg-[#07080b] border border-slate-300/15 rounded-lg mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'login' ? 'bg-slate-200 text-black font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Member Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'register' ? 'bg-slate-200 text-black font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Join Our Family
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-lg bg-red-950/50 border border-red-500/40 flex items-start gap-2.5 text-sm text-red-200">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 flex items-start gap-2.5 text-sm text-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-id" className="block text-xs font-medium text-slate-300 mb-1.5">
                Email atau Username
              </label>
              <input
                id="login-id"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="nama@email.com atau username"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-300"
              />
            </div>

            <div>
              <label htmlFor="login-pw" className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-pw"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full px-3.5 py-2.5 pr-11 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Sembunyikan password' : 'Lihat password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-500 bg-[#07080b]"
                />
                <span>Remember session (30 hari)</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-xs text-slate-300 hover:text-white underline cursor-pointer"
              >
                Lupa Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg chrome-btn-primary text-sm min-h-[44px] disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
            </button>

            <div className="pt-4 mt-4 border-t border-slate-300/10 text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>Akses Founding CAPSU perdana tersedia untuk konfigurasi awal.</span>
              <button
                type="button"
                onClick={fillCapsuStarter}
                className="inline-flex items-center gap-1.5 text-slate-200 hover:text-white underline shrink-0 cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Isi Kredensial CAPSU</span>
              </button>
            </div>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nama Lengkap
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama asli / panggilan resmi"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-300"
                />
              </div>
              <div>
                <label htmlFor="reg-username" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Username
                </label>
                <input
                  id="reg-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="contoh: putra_waluh"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Aktif
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="anggota@email.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-300"
                />
              </div>
              <div>
                <label htmlFor="reg-pass" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password (min. 8 karakter)
                </label>
                <input
                  id="reg-pass"
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-300"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-info" className="block text-xs font-medium text-slate-300 mb-1.5">
                Informasi Tambahan (Asal / Discord / Alasan Bergabung)
              </label>
              <textarea
                id="reg-info"
                rows={2}
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="Ceritakan singkat latar belakang atau referensi anggota yang mengenal Anda"
                className="w-full px-3.5 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-300"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-300 mb-1.5">Foto Profil (Opsional)</span>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg chrome-btn-secondary text-xs cursor-pointer min-h-[40px]">
                  <Upload className="h-4 w-4" />
                  <span>Unggah Foto</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarFile} className="hidden" />
                </label>
                {avatarUrl && (
                  <div className="flex items-center gap-2">
                    <img src={avatarUrl} alt="Preview profil" className="h-10 w-10 rounded-full object-cover border border-slate-400/30" />
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-1 space-y-2">
              <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={(e) => setRulesAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-500 bg-[#07080b]"
                />
                <span>
                  Saya menyetujui seluruh{' '}
                  <button
                    type="button"
                    onClick={() => setShowRulesDrawer((v) => !v)}
                    className="text-white underline cursor-pointer"
                  >
                    Aturan Komunitas WALUH FAMILY
                  </button>{' '}
                  dan memahami akun saya berstatus PENDING hingga disetujui pengurus.
                </span>
              </label>

              {showRulesDrawer && (
                <div className="p-3 rounded-lg bg-[#07080b] border border-slate-300/15 text-xs text-slate-400 space-y-1.5 max-h-36 overflow-y-auto">
                  {rules.map((r, i) => (
                    <p key={i}>
                      {i + 1}. {r}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg chrome-btn-primary text-sm min-h-[44px] disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Mengirim Pendaftaran...' : 'Kirim Pendaftaran Anggota'}
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Masukkan email akun Anda untuk membuat token pemulihan password yang berlaku selama 30 menit.
            </p>
            <div>
              <label htmlFor="forgot-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Terdaftar
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="email@waluhfamily.org"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white focus:outline-none focus:border-slate-300"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg chrome-btn-primary text-sm min-h-[44px] cursor-pointer"
            >
              {loading ? 'Memproses...' : 'Buat Token Reset Password'}
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Kembali ke Login
            </button>
          </form>
        )}

        {/* RESET PASSWORD */}
        {mode === 'reset' && (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label htmlFor="reset-token" className="block text-xs font-medium text-slate-300 mb-1.5">
                Token Pemulihan
              </label>
              <input
                id="reset-token"
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Tempel token pemulihan"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm font-mono text-white focus:outline-none focus:border-slate-300"
              />
            </div>
            <div>
              <label htmlFor="reset-new-pw" className="block text-xs font-medium text-slate-300 mb-1.5">
                Password Baru (min. 8 karakter)
              </label>
              <input
                id="reset-new-pw"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Masukkan password baru"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white focus:outline-none focus:border-slate-300"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg chrome-btn-primary text-sm min-h-[44px] cursor-pointer"
            >
              {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
