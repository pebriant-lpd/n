import React, { useState } from 'react';
import { Menu, X, Shield, Users, Compass, Handshake, Award, Heart, ArrowRight, Mail } from 'lucide-react';
import type { PublicOverview } from '../types';
import { MemberAvatar, WaluhLogo } from './WaluhLogo';

interface PublicHomepageProps {
  overview: PublicOverview | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

const HERO_BACKDROP_SRC = '/src/assets/images/hero_chrome_backdrop_1794905347793.jpg';

const CORE_VALUES = [
  {
    name: 'Loyalty',
    desc: 'Kesetiaan tanpa syarat menjaga kehormatan keluarga dan komitmen bersama dalam suka maupun duka.',
    icon: Shield,
  },
  {
    name: 'Brotherhood',
    desc: 'Ikatan persaudaraan erat yang melampaui batas jarak, latar belakang, dan perbedaan individu.',
    icon: Users,
  },
  {
    name: 'Trust',
    desc: 'Kepercayaan yang dijaga melalui kejujuran, integritas pribadi, dan transparansi organisasi.',
    icon: Handshake,
  },
  {
    name: 'Respect',
    desc: 'Saling menghormati martabat, pendapat, serta peran setiap anggota di dalam keluarga besar.',
    icon: Award,
  },
  {
    name: 'Solidarity',
    desc: 'Kebulatan tekad untuk berdiri bersama, saling menopang, dan bergerak satu suara.',
    icon: Compass,
  },
  {
    name: 'Togetherness',
    desc: 'Kebersamaan yang hangat menjadikan WALUH Family rumah pulang bagi setiap anggota.',
    icon: Heart,
  },
];

const LEADERSHIP_SLOTS = [
  { roleCode: 'CAPSU', label: 'Kepala Suku / CAPSU', subtitle: 'Pemegang Otoritas Tertinggi' },
  { roleCode: 'DEPUTI', label: 'Deputi / Wakil', subtitle: 'Pengawas & Wakil Pimpinan' },
  { roleCode: 'ADMIN', label: 'Admin', subtitle: 'Operasional & Database Anggota' },
  { roleCode: 'BENDAHARA', label: 'Bendahara', subtitle: 'Pengelola Donasi & Transparansi' },
];

export const PublicHomepage: React.FC<PublicHomepageProps> = ({ overview, onOpenAuth }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [backdropError, setBackdropError] = useState(false);

  const community = overview?.community;
  const leadership = overview?.leadership ?? [];
  const activeMembersCount = overview?.activeMembersCount ?? 0;

  const navItems = [
    { label: 'Home', href: '#home' },
    { label: 'About', href: '#about' },
    { label: 'Vision & Mission', href: '#vision-mission' },
    { label: 'Leadership', href: '#leadership' },
    { label: 'Join Our Family', href: '#join-family' },
  ];

  return (
    <div className="min-h-screen bg-[#050506] text-slate-100 flex flex-col">
      {/* NAVBAR: 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#050506]/90 backdrop-blur-md border-b border-slate-300/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand wordmark */}
          <a href="#home" className="flex items-center gap-3 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded">
            <WaluhLogo className="h-9 w-9 rounded-sm" />
            <span className="font-display text-base sm:text-lg font-semibold tracking-wider text-slate-100 whitespace-nowrap shrink-0">
              WALUH FAMILY
            </span>
          </a>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav aria-label="Navigasi Utama" className="hidden lg:flex items-center gap-7">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-slate-300/60"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Zone 3: 1 primary action + mobile drawer trigger */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm rounded-lg chrome-btn-primary whitespace-nowrap shrink-0 min-h-[40px] cursor-pointer"
            >
              Member Login
            </button>
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden inline-flex items-center justify-center p-2.5 rounded-lg border border-slate-300/20 text-slate-200 hover:bg-white/5 min-h-[44px] min-w-[44px] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-300/15 bg-[#090a0d] px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-3 text-sm font-medium text-slate-200 hover:text-white hover:bg-white/5 rounded-lg"
              >
                {item.label}
              </a>
            ))}
            <div className="pt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('register');
                }}
                className="px-4 py-3 text-sm font-medium rounded-lg chrome-btn-secondary min-h-[44px] cursor-pointer"
              >
                Join Family
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('login');
                }}
                className="px-4 py-3 text-sm font-semibold rounded-lg chrome-btn-primary min-h-[44px] cursor-pointer"
              >
                Member Login
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* B. HERO SECTION */}
        <section id="home" className="relative overflow-hidden border-b border-slate-300/10">
          {!backdropError ? (
            <img
              src={HERO_BACKDROP_SRC}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              onError={() => setBackdropError(true)}
              className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none"
            />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(148,163,184,0.14),_transparent_65%)] pointer-events-none"
            />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-[#050506]/70 via-[#050506]/80 to-[#050506] pointer-events-none"
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28 flex flex-col items-center text-center">
            <div className="p-2 rounded-2xl bg-[#050506]/90 border border-slate-300/20 shadow-[0_0_50px_rgba(226,232,240,0.08)] mb-8">
              <WaluhLogo className="h-36 w-36 sm:h-44 sm:w-44 rounded-xl" />
            </div>

            <p className="text-xs sm:text-sm tracking-[0.28em] text-slate-300 font-medium uppercase mb-3">
              {community?.fullName || 'WELLBORN FAMILY'}
            </p>

            <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-wider chrome-text text-balance mb-4">
              {community?.platformName || 'WALUH FAMILY'}
            </h1>

            <p className="font-display text-lg sm:text-2xl tracking-[0.18em] text-slate-200 mb-3">
              {community?.tagline || 'ONE FAMILY. ONE LEGACY.'}
            </p>

            <p className="text-sm sm:text-base text-slate-400 tracking-wide mb-6">
              {community?.secondaryTagline || 'United by Loyalty, Strengthened by Brotherhood.'}
            </p>

            <p className="max-w-2xl text-base sm:text-lg text-slate-300 leading-relaxed mb-10">
              A community built on loyalty, trust, friendship, respect, and brotherhood.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm rounded-lg chrome-btn-primary whitespace-nowrap min-h-[44px] cursor-pointer"
              >
                <span>JOIN OUR FAMILY</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="inline-flex items-center justify-center px-7 py-3.5 text-sm font-medium rounded-lg chrome-btn-secondary whitespace-nowrap min-h-[44px] cursor-pointer"
              >
                MEMBER LOGIN
              </button>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-300/10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-400">
              <span className="tabular-nums">{activeMembersCount} Anggota Aktif Terverifikasi</span>
              <span aria-hidden="true">·</span>
              <span>Periode Donasi Mingguan Senin–Minggu (WIB)</span>
              <span aria-hidden="true">·</span>
              <span>5 Tingkat Tata Kelola Kepengurusan</span>
            </div>
          </div>
        </section>

        {/* C. ABOUT WALUH FAMILY */}
        <section id="about" className="py-16 sm:py-24 border-b border-slate-300/10 bg-[#07080b]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-4">
                <p className="text-xs tracking-[0.22em] text-slate-400 uppercase mb-2">Tentang Kami</p>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white text-balance">
                  Rumah Bersama WELLBORN FAMILY
                </h2>
              </div>
              <div className="lg:col-span-8 space-y-6">
                <blockquote className="text-lg sm:text-xl text-slate-200 leading-relaxed font-normal">
                  &ldquo;
                  {community?.philosophy ||
                    'WALUH Family adalah rumah bersama bagi setiap anggota. Tempat membangun persahabatan, menjaga kepercayaan, memperkuat solidaritas, dan tumbuh bersama sebagai satu keluarga.'}
                  &rdquo;
                </blockquote>
                <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                  Setiap anggota yang tergabung dalam WALUH FAMILY memiliki akses ke ruang kolaborasi terstruktur,
                  jadwal kegiatan komunitas, pengumuman resmi kepemimpinan, serta sistem transparansi donasi koin yang
                  dicatat dan diaudit secara terbuka oleh Bendahara dan Dewan Pengurus.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* D. VISION & MISSION */}
        <section id="vision-mission" className="py-16 sm:py-24 border-b border-slate-300/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-5 chrome-surface rounded-xl p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <p className="text-xs tracking-[0.22em] text-slate-400 uppercase mb-3">Visi Komunitas</p>
                  <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white mb-5 text-balance">
                    Satu Keluarga, Satu Warisan
                  </h2>
                  <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
                    {community?.vision ||
                      'Membangun keluarga komunitas yang solid, harmonis, terpercaya, dan memiliki rasa persaudaraan yang kuat.'}
                  </p>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-300/15 text-xs text-slate-400">
                  Berlandaskan tata kelola transparan dan akuntabilitas kepengurusan.
                </div>
              </div>

              <div className="lg:col-span-7 chrome-surface rounded-xl p-6 sm:p-8">
                <p className="text-xs tracking-[0.22em] text-slate-400 uppercase mb-3">Misi Komunitas</p>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-white mb-6">
                  Lima Pilar Pergerakan Keluarga
                </h3>
                <ol className="space-y-4">
                  {(community?.mission ?? [
                    'Menjaga persatuan dan solidaritas antaranggota.',
                    'Membangun lingkungan yang nyaman dan saling menghargai.',
                    'Mengembangkan komunikasi dan kerja sama.',
                    'Menjaga transparansi serta tanggung jawab organisasi.',
                    'Menciptakan kegiatan yang mempererat hubungan anggota.',
                  ]).map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-4 pb-4 border-b border-slate-300/10 last:border-b-0 last:pb-0"
                    >
                      <span className="font-mono text-sm font-semibold text-slate-300 tabular-nums shrink-0 pt-0.5">
                        0{idx + 1}.
                      </span>
                      <span className="text-sm sm:text-base text-slate-200 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* E. CORE VALUES */}
        <section className="py-16 sm:py-24 border-b border-slate-300/10 bg-[#07080b]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className="text-xs tracking-[0.22em] text-slate-400 uppercase mb-2">Nilai Inti</p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white text-balance">
                Enam Nilai Utama WALUH FAMILY
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {CORE_VALUES.map((val) => {
                const Icon = val.icon;
                return (
                  <div
                    key={val.name}
                    className="chrome-surface rounded-xl p-6 transition-colors hover:border-slate-300/35"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-lg font-semibold text-white">{val.name}</h3>
                      <Icon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{val.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* F. LEADERSHIP PREVIEW */}
        <section id="leadership" className="py-16 sm:py-24 border-b border-slate-300/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
              <div>
                <p className="text-xs tracking-[0.22em] text-slate-400 uppercase mb-2">Struktur Kepemimpinan</p>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white">
                  Dewan Pengurus Resmi
                </h2>
              </div>
              <p className="text-sm text-slate-400 max-w-md">
                Data jabatan dan profil pengurus dikelola langsung melalui sistem tata kelola database WALUH FAMILY.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {LEADERSHIP_SLOTS.map((slot) => {
                const officers = leadership.filter((l) => l.roleCode === slot.roleCode);
                const lead = officers[0];
                return (
                  <div key={slot.roleCode} className="chrome-surface rounded-xl p-6 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-400 tracking-wide mb-4">
                        {slot.label}
                      </p>
                      {lead ? (
                        <>
                          <div className="flex items-center gap-3.5 mb-4">
                            <MemberAvatar src={lead.avatarUrl} name={lead.fullName} sizeClass="h-14 w-14 text-sm" />
                            <div className="min-w-0">
                              <h3 className="font-semibold text-white text-base truncate">{lead.fullName}</h3>
                              <p className="text-xs text-slate-400 truncate">@{lead.username}</p>
                            </div>
                          </div>
                          <p className="text-xs font-medium text-slate-300 mb-2">{lead.jabatan}</p>
                          <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
                            {lead.bio || slot.subtitle}
                          </p>
                          {officers.length > 1 && (
                            <p className="mt-3 text-xs text-slate-400">
                              +{officers.length - 1} pengurus tambahan di jabatan ini
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="py-4">
                          <div className="h-14 w-14 rounded-full border border-dashed border-slate-500/40 flex items-center justify-center text-xs text-slate-500 mb-4">
                            Open
                          </div>
                          <h3 className="font-medium text-slate-300 text-base mb-1">Menunggu Pelantikan</h3>
                          <p className="text-sm text-slate-500 leading-relaxed">{slot.subtitle}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* G. JOIN OUR FAMILY */}
        <section id="join-family" className="py-16 sm:py-24 bg-[#07080b]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="chrome-surface rounded-2xl p-8 sm:p-12">
              <p className="text-xs tracking-[0.24em] text-slate-400 uppercase mb-3">Pendaftaran Anggota</p>
              <h2 className="font-display text-2xl sm:text-4xl font-bold text-white mb-4 text-balance">
                Bergabunglah Bersama Keluarga Besar WALUH FAMILY
              </h2>
              <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
                Setiap pendaftaran baru akan diverifikasi langsung oleh CAPSU atau Admin guna menjaga kualitas,
                keamanan, dan kepercayaan di dalam lingkungan WELLBORN FAMILY.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm rounded-lg chrome-btn-primary min-h-[44px] cursor-pointer"
                >
                  <span>Daftar Sebagai Anggota</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-sm font-medium rounded-lg chrome-btn-secondary min-h-[44px] cursor-pointer"
                >
                  Sudah Punya Akun? Login
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* H. FOOTER */}
      <footer className="border-t border-slate-300/15 bg-[#040405] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-8 border-b border-slate-300/10">
            <div className="flex items-center gap-4">
              <WaluhLogo className="h-12 w-12 rounded" />
              <div>
                <p className="font-display text-lg font-semibold tracking-wider text-white">WALUH FAMILY</p>
                <p className="text-xs tracking-[0.2em] text-slate-400 mt-0.5">ONE FAMILY. ONE LEGACY.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
              <a href="#about" className="hover:text-white transition-colors">
                About
              </a>
              <a
                href={`mailto:${community?.contactEmail || 'council@waluhfamily.org'}`}
                className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span>Contact</span>
              </a>
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Terms &amp; Conditions
              </button>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>&copy; {new Date().getFullYear()} WALUH FAMILY — WELLBORN FAMILY. All rights reserved.</p>
            <p>United by Loyalty, Strengthened by Brotherhood.</p>
          </div>
        </div>
      </footer>

      {/* Privacy & Terms Modal */}
      {legalModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="chrome-surface rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-300/15 pb-3">
              <h3 className="font-display text-lg font-semibold text-white">
                {legalModal === 'privacy' ? 'Privacy Policy — WALUH FAMILY' : 'Terms & Conditions — WALUH FAMILY'}
              </h3>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                aria-label="Tutup modal"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {legalModal === 'privacy' ? (
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                <p>
                  WALUH FAMILY melindungi seluruh kredensial anggota dengan enkripsi hash kriptografis (scrypt) serta
                  sesi HTTP-only yang aman. Email dan catatan verifikasi internal tidak pernah ditampilkan di halaman
                  direktori atau transparansi donasi publik.
                </p>
                <p>
                  Nama anggota dan jumlah kontribusi koin ditampilkan pada halaman Donation Transparency khusus bagi
                  anggota terverifikasi sebagai wujud keterbukaan dan akuntabilitas komunitas.
                </p>
                <p>{community?.retentionPolicy}</p>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                <p>Dengan bergabung di WALUH FAMILY, setiap anggota wajib mematuhi kode etik berikut:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
                  {(community?.rules ?? []).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 text-sm rounded-lg chrome-btn-primary cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
