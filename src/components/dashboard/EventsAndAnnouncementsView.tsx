import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, Plus, Users, Megaphone, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch, fileToCompressedAvatarDataUrl, formatDateId, formatDateTimeWib, getJakartaTodayYmd } from '../../lib/api';
import type { UserProfile } from '../../types';
import { MemberAvatar } from '../WaluhLogo';

const DEFAULT_EVENT_POSTER = '/src/assets/images/event_royal_gathering_1794905347795.jpg';

interface EventItem {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  location: string;
  poster_url: string;
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  rsvpEnabled: boolean;
  creator_name: string;
  myRsvp: string | null;
  goingCount: number;
  attendees: Array<{
    profile_id: string;
    rsvp_status: string;
    full_name: string;
    username: string;
    avatar_url: string;
  }>;
}

export const EventsView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const canManage = user.permissions.includes('events.manage') || user.roleCode === 'CAPSU';
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Create form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(getJakartaTodayYmd());
  const [eventTime, setEventTime] = useState('20:00 WIB');
  const [location, setLocation] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ events: EventItem[] }>('/api/events');
      setEvents(res.events);
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memuat event.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleRsvp = async (eventId: string, rsvpStatus: 'GOING' | 'MAYBE' | 'DECLINED') => {
    try {
      await apiFetch(`/api/events/${eventId}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ rsvpStatus }),
      });
      setFeedback({ type: 'success', msg: 'Konfirmasi kehadiran Anda berhasil diperbarui.' });
      await loadEvents();
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menyimpan RSVP.' });
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await apiFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify({ title, description, eventDate, eventTime, location, posterUrl }),
      });
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setLocation('');
      setPosterUrl('');
      setFeedback({ type: 'success', msg: 'Event komunitas berhasil diterbitkan.' });
      await loadEvents();
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal membuat event.' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/api/events/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setFeedback({ type: 'success', msg: `Status event diperbarui menjadi ${status}.` });
      await loadEvents();
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memperbarui status.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-300/15">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Agenda &amp; Pertemuan</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">Community Events</h1>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg chrome-btn-primary text-xs sm:text-sm whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Event Baru</span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-sm ${
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

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="chrome-surface rounded-xl h-72 animate-pulse" />
          <div className="chrome-surface rounded-xl h-72 animate-pulse" />
        </div>
      ) : events.length === 0 ? (
        <div className="chrome-surface rounded-xl p-12 text-center space-y-2">
          <Calendar className="h-8 w-8 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-300 font-medium">Belum ada agenda event komunitas</p>
          <p className="text-xs text-slate-500">
            Pengurus berwenang (CAPSU, Deputi, Admin) dapat menjadwalkan kegiatan keluarga di sini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {events.map((ev) => (
            <article key={ev.id} className="chrome-surface rounded-xl overflow-hidden flex flex-col">
              <div className="relative h-48 bg-[#090a0d] overflow-hidden">
                <img
                  src={ev.poster_url || DEFAULT_EVENT_POSTER}
                  alt={ev.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c10] via-black/30 to-transparent" />
                <div className="absolute bottom-3 left-5 right-5 flex items-center justify-between text-xs text-slate-200">
                  <span className="font-mono tabular-nums">
                    {formatDateId(ev.event_date)} {ev.event_time ? `· ${ev.event_time}` : ''}
                  </span>
                  <span className="font-semibold tracking-wide">{ev.status}</span>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-white mb-2">{ev.title}</h2>
                  <p className="text-sm text-slate-300 leading-relaxed line-clamp-3 mb-3">{ev.description}</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {ev.location}
                    </span>
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Users className="h-3.5 w-3.5" />
                      {ev.goingCount} Hadir
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-300/10 flex flex-wrap items-center justify-between gap-3">
                  {ev.rsvpEnabled && ev.status !== 'CANCELLED' && ev.status !== 'COMPLETED' ? (
                    <div className="flex items-center gap-1.5">
                      {(['GOING', 'MAYBE', 'DECLINED'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleRsvp(ev.id, opt)}
                          className={`px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                            ev.myRsvp === opt
                              ? 'bg-slate-200 text-black font-semibold'
                              : 'border border-slate-300/20 text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          {opt === 'GOING' ? 'Hadir' : opt === 'MAYBE' ? 'Ragu' : 'Berhalangan'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">RSVP ditutup</span>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(ev)}
                      className="px-3 py-1.5 text-xs rounded-md chrome-btn-secondary cursor-pointer"
                    >
                      Detail &amp; Peserta
                    </button>
                    {canManage && (
                      <select
                        value={ev.status}
                        onChange={(e) => handleUpdateStatus(ev.id, e.target.value)}
                        aria-label="Ubah status event"
                        className="px-2 py-1.5 text-xs rounded-md bg-[#07080b] border border-slate-300/20 text-slate-200"
                      >
                        <option value="UPCOMING">UPCOMING</option>
                        <option value="ONGOING">ONGOING</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create Event Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="chrome-surface rounded-xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-300/15 pb-3">
              <h3 className="font-display text-lg font-semibold text-white">Buat Event Komunitas</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Judul Event</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Waktu</label>
                  <input
                    type="text"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    placeholder="20:00 WIB"
                    className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Lokasi / Voice Channel</label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Discord Main Hall / Jakarta Selatan"
                  className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Deskripsi Kegiatan</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Poster Event (Opsional)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setPosterUrl(await fileToCompressedAvatarDataUrl(f));
                  }}
                  className="text-xs text-slate-300"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm rounded-lg chrome-btn-secondary cursor-pointer">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg chrome-btn-primary cursor-pointer">
                  {saving ? 'Menyimpan...' : 'Terbitkan Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="chrome-surface rounded-xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-300/15 pb-3">
              <h3 className="font-display text-lg font-semibold text-white">{selectedEvent.title}</h3>
              <button type="button" onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{selectedEvent.description}</p>
            <div className="text-xs text-slate-400 space-y-1">
              <p>Tanggal: {formatDateId(selectedEvent.event_date)} {selectedEvent.event_time}</p>
              <p>Lokasi: {selectedEvent.location}</p>
              <p>Dibuat oleh: {selectedEvent.creator_name}</p>
            </div>
            <div className="pt-3 border-t border-slate-300/15">
              <p className="text-xs font-semibold text-slate-300 mb-2">
                Daftar Konfirmasi Peserta ({selectedEvent.attendees.length})
              </p>
              {selectedEvent.attendees.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada anggota yang mengonfirmasi kehadiran.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedEvent.attendees.map((a) => (
                    <div key={a.profile_id} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2">
                        <MemberAvatar src={a.avatar_url} name={a.full_name} sizeClass="h-6 w-6 text-[10px]" />
                        <span className="text-white">{a.full_name}</span>
                        <span className="text-slate-500">@{a.username}</span>
                      </div>
                      <span className="text-slate-300 font-medium">{a.rsvp_status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  image_url: string;
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  author_name: string;
  author_role: string;
  published_at: string | null;
  created_at: string;
}

export const AnnouncementsView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const canManage = user.permissions.includes('announcements.manage') || user.roleCode === 'CAPSU';
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'PUBLISHED' | 'DRAFT'>('PUBLISHED');
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ announcements: AnnouncementItem[] }>('/api/announcements');
      setItems(res.announcements);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, content, status }),
    });
    setTitle('');
    setContent('');
    setCreateOpen(false);
    setFeedback('Pengumuman berhasil disimpan.');
    await load();
  };

  const handleStatusChange = async (id: string, nextStatus: string) => {
    await apiFetch(`/api/announcements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    setFeedback(`Status pengumuman diperbarui ke ${nextStatus}.`);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-300/15">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Informasi Resmi Pengurus</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">Announcements</h1>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg chrome-btn-primary text-xs sm:text-sm self-start sm:self-auto cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Pengumuman</span>
          </button>
        )}
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-sm text-emerald-200">
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="chrome-surface rounded-xl h-48 animate-pulse" />
      ) : items.length === 0 ? (
        <div className="chrome-surface rounded-xl p-12 text-center space-y-2">
          <Megaphone className="h-8 w-8 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-300">Belum ada pengumuman yang tersedia.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article key={item.id} className="chrome-surface rounded-xl p-6 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-white">{item.title}</h2>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{item.status}</span>
                  {canManage && (
                    <select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      className="px-2 py-1 rounded bg-[#07080b] border border-slate-300/20 text-slate-200"
                    >
                      <option value="PUBLISHED">PUBLISHED</option>
                      <option value="DRAFT">DRAFT</option>
                      <option value="ARCHIVED">ARCHIVED</option>
                    </select>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{item.content}</p>
              <p className="text-xs text-slate-500 pt-2 border-t border-slate-300/10">
                Ditulis oleh {item.author_name} ({item.author_role}) ·{' '}
                {formatDateTimeWib(item.published_at || item.created_at)}
              </p>
            </article>
          ))}
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="chrome-surface rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-300/15 pb-3">
              <h3 className="font-display text-lg font-semibold text-white">Tulis Pengumuman Resmi</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Judul</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Isi Pengumuman</label>
                <textarea
                  rows={4}
                  required
                  minLength={10}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Status Publikasi</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'PUBLISHED' | 'DRAFT')}
                  className="w-full px-3 py-2 rounded-lg bg-[#07080b] border border-slate-300/20 text-sm text-white"
                >
                  <option value="PUBLISHED">Terbitkan Sekarang (PUBLISHED)</option>
                  <option value="DRAFT">Simpan Sebagai Draft (DRAFT)</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm rounded-lg chrome-btn-secondary cursor-pointer">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg chrome-btn-primary cursor-pointer">
                  Simpan Pengumuman
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
