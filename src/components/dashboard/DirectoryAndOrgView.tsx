import React, { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { apiFetch, formatCoins, formatDateId } from '../../lib/api';
import { MemberAvatar } from '../WaluhLogo';

interface DirectoryMember {
  id: string;
  username: string;
  fullName: string;
  roleCode: string;
  roleName: string;
  jabatan: string;
  bio: string;
  avatarUrl: string;
  status: string;
  joinedAt: string | null;
  totalDonations: number;
}

export const MemberDirectoryView: React.FC = () => {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [selected, setSelected] = useState<DirectoryMember | null>(null);

  useEffect(() => {
    apiFetch<{ members: DirectoryMember[] }>('/api/directory')
      .then((res) => setMembers(res.members))
      .finally(() => setLoading(false));
  }, []);

  const filtered = members.filter((m) => {
    if (roleFilter !== 'ALL' && m.roleCode !== roleFilter) return false;
    if (
      search.trim() &&
      !m.fullName.toLowerCase().includes(search.toLowerCase()) &&
      !m.username.toLowerCase().includes(search.toLowerCase()) &&
      !m.jabatan.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-slate-300/15">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Keluarga Terdaftar</p>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">Member Directory</h1>
        <p className="text-sm text-slate-400 mt-1">
          Menghormati pengaturan privasi setiap anggota tanpa menampilkan informasi sensitif.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, username, atau jabatan..."
            className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white placeholder:text-slate-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
        >
          <option value="ALL">Semua Jabatan</option>
          <option value="CAPSU">CAPSU / Kepala Suku</option>
          <option value="DEPUTI">Deputi / Wakil</option>
          <option value="ADMIN">Admin</option>
          <option value="BENDAHARA">Bendahara</option>
          <option value="MEMBER">Member</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="chrome-surface rounded-xl h-36 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="chrome-surface rounded-xl p-10 text-center text-sm text-slate-500">
          Tidak ada anggota yang sesuai pencarian.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m)}
              className="text-left chrome-surface rounded-xl p-5 hover:border-slate-300/35 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5 mb-3">
                <MemberAvatar src={m.avatarUrl} name={m.fullName} sizeClass="h-12 w-12 text-sm" />
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{m.fullName}</p>
                  <p className="text-xs text-slate-400 truncate">@{m.username}</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 font-medium mb-1">
                {m.roleName} · {m.jabatan}
              </p>
              <p className="text-xs text-slate-500">
                {m.joinedAt ? `Bergabung ${formatDateId(m.joinedAt)}` : 'Tanggal gabung privat'} ·{' '}
                <span className="text-emerald-400">Approved</span>
              </p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="chrome-surface rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-300/15 pb-3">
              <h3 className="font-display text-lg font-semibold text-white">Profil Anggota</h3>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <MemberAvatar src={selected.avatarUrl} name={selected.fullName} sizeClass="h-16 w-16 text-lg" />
              <div>
                <h4 className="text-lg font-semibold text-white">{selected.fullName}</h4>
                <p className="text-sm text-slate-400">@{selected.username}</p>
                <p className="text-xs text-slate-300 mt-1">
                  {selected.roleName} · {selected.jabatan}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{selected.bio || 'Belum ada bio anggota.'}</p>
            <div className="pt-3 border-t border-slate-300/15 text-xs text-slate-400 space-y-1">
              <p>Status Keanggotaan: <span className="text-emerald-400 font-medium">{selected.status}</span></p>
              <p>Bergabung: {selected.joinedAt ? formatDateId(selected.joinedAt) : 'Disembunyikan oleh anggota'}</p>
              <p className="font-mono tabular-nums">Total Donasi Terverifikasi: {formatCoins(selected.totalDonations)} koin</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface OrgGroup {
  roleCode: string;
  roleName: string;
  rankOrder: number;
  description: string;
  members: Array<{
    id: string;
    username: string;
    fullName: string;
    jabatan: string;
    bio: string;
    avatarUrl: string;
    joinedAt: string | null;
  }>;
}

export const OrganizationStructureView: React.FC = () => {
  const [groups, setGroups] = useState<OrgGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ structure: OrgGroup[] }>('/api/organization')
      .then((res) => setGroups(res.structure))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-slate-300/15">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Hierarki Kepemimpinan</p>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">Organization Structure</h1>
        <p className="text-sm text-slate-400 mt-1">
          Struktur kepengurusan langsung berasal dari database dan hanya dapat diubah oleh otoritas berwenang.
        </p>
      </div>

      {loading ? (
        <div className="chrome-surface rounded-xl h-52 animate-pulse" />
      ) : (
        <div className="space-y-6">
          {groups.map((grp) => (
            <section key={grp.roleCode} className="chrome-surface rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-300/10">
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">{grp.roleName}</h2>
                  <p className="text-xs text-slate-400">{grp.description}</p>
                </div>
                <span className="font-mono text-xs text-slate-400 tabular-nums">{grp.members.length} Personel</span>
              </div>

              {grp.members.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada anggota yang dilantik pada tingkatan ini.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grp.members.map((m) => (
                    <div key={m.id} className="p-4 rounded-lg bg-[#07080b] border border-slate-300/10 flex items-start gap-3.5">
                      <MemberAvatar src={m.avatarUrl} name={m.fullName} sizeClass="h-11 w-11 text-xs" />
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm truncate">{m.fullName}</p>
                        <p className="text-xs text-slate-400 truncate">@{m.username} · {m.jabatan}</p>
                        {m.bio && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.bio}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
