export interface WeekPeriod {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  monthKey: string;
}

const JAKARTA_TZ = 'Asia/Jakarta';

/**
 * Returns current date string YYYY-MM-DD and ISO-like timestamp in Asia/Jakarta (UTC+7).
 */
export function getJakartaNow(): { date: string; iso: string; displayTime: string } {
  const now = new Date();
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: JAKARTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const date = dateFmt.format(now);
  const time = timeFmt.format(now);
  return {
    date,
    iso: `${date}T${time}+07:00`,
    displayTime: `${date} ${time} WIB`,
  };
}

/**
 * Computes Monday–Sunday weekly period in Asia/Jakarta from a YYYY-MM-DD date string.
 * Monthly key is strictly derived from the transaction's own YYYY-MM date.
 */
export function getMondaySundayWeekPeriod(dateStr: string): WeekPeriod {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('Format tanggal tidak valid. Gunakan YYYY-MM-DD.');
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  // Construct UTC midnight for calendar arithmetic without local DST distortion
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new Error('Tanggal kalender tidak valid.');
  }

  // getUTCDay(): 0=Sun, 1=Mon, ..., 6=Sat -> convert to Mon=0..Sun=6
  const dayOfWeekMon0 = (dt.getUTCDay() + 6) % 7;

  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() - dayOfWeekMon0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const formatYmd = (dateObj: Date) => dateObj.toISOString().slice(0, 10);
  const weekStart = formatYmd(monday);
  const weekEnd = formatYmd(sunday);

  // Compute ISO Week Year & ISO Week Number from Thursday of that Monday-Sunday week
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

  const weekLabel =
    monday.getUTCFullYear() === sunday.getUTCFullYear()
      ? `${sDay} ${sMon} – ${eDay} ${eMon} ${eYear}`
      : `${sDay} ${sMon} ${monday.getUTCFullYear()} – ${eDay} ${eMon} ${eYear}`;

  return {
    weekKey,
    weekStart,
    weekEnd,
    weekLabel,
    monthKey: dateStr.slice(0, 7),
  };
}

export function getCurrentJakartaWeek(): WeekPeriod {
  return getMondaySundayWeekPeriod(getJakartaNow().date);
}
