import type { WeekPeriod } from '../types';

export async function apiFetch<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const errMsg =
      typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Permintaan gagal (${res.status})`;
    throw new Error(errMsg);
  }

  return data as T;
}

export function getJakartaTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function computeMondaySundayPreview(dateStr: string): WeekPeriod | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;

  const dayOfWeekMon0 = (dt.getUTCDay() + 6) % 7;
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() - dayOfWeekMon0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Mon0 = (jan4.getUTCDay() + 6) % 7;
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - jan4Mon0);
  const diffDays = Math.round((monday.getTime() - firstMonday.getTime()) / 86400000);
  const weekNum = Math.floor(diffDays / 7) + 1;

  const weekKey = `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const sDay = monday.getUTCDate();
  const sMon = monthNames[monday.getUTCMonth()];
  const eDay = sunday.getUTCDate();
  const eMon = monthNames[sunday.getUTCMonth()];
  const eYear = sunday.getUTCFullYear();

  return {
    weekKey,
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
    weekLabel:
      monday.getUTCFullYear() === sunday.getUTCFullYear()
        ? `${sDay} ${sMon} – ${eDay} ${eMon} ${eYear}`
        : `${sDay} ${sMon} ${monday.getUTCFullYear()} – ${eDay} ${eMon} ${eYear}`,
    monthKey: dateStr.slice(0, 7),
  };
}

export function formatCoins(val: number): string {
  return new Intl.NumberFormat('id-ID').format(val);
}

export function formatDateTimeWib(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d) + ' WIB'
  );
}

export function formatDateId(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const parts = ymd.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return ymd;
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export async function fileToCompressedAvatarDataUrl(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Gunakan file gambar PNG, JPG, atau WebP.');
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error('Ukuran file maksimal 4MB.');
  }

  const bitmap = await createImageBitmap(file);
  const maxDim = 420;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung pemrosesan gambar.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL('image/webp', 0.85);
}
