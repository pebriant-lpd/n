import type { Express, NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import {
  createNotification,
  db,
  getPermissionsForRole,
  notifyAllApprovedMembers,
  notifyRoles,
  writeAuditLog,
} from './db.ts';
import {
  generateId,
  generateTxCode,
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './auth.ts';
import { getCurrentJakartaWeek, getJakartaNow, getMondaySundayWeekPeriod } from './time.ts';

interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleCode: string;
  roleName: string;
  jabatan: string;
  bio: string;
  avatarUrl: string;
  additionalInfo: string;
  status: string;
  privacyShowJoined: boolean;
  privacyShowDonations: boolean;
  joinedAt: string | null;
  sessionId: string;
  permissions: string[];
}

interface AuthedRequest extends Request {
  auth?: AuthUser;
}

const SESSION_COOKIE = 'waluh_session';

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || '';
}

function getSettingsMap(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM community_settings').all() as Array<{ key: string; value: string }>;
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

function validateAvatarInput(avatarUrl: unknown): string {
  if (typeof avatarUrl !== 'string') return '';
  const trimmed = avatarUrl.trim();
  if (!trimmed) return '';
  if (trimmed.length > 650_000) {
    throw new Error('Ukuran gambar profil terlalu besar (maksimal ~450KB).');
  }
  if (
    trimmed.startsWith('data:image/png;base64,') ||
    trimmed.startsWith('data:image/jpeg;base64,') ||
    trimmed.startsWith('data:image/webp;base64,') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  throw new Error('Format foto profil tidak didukung. Gunakan PNG, JPG, WebP, atau URL HTTPS.');
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const cookieToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const token = cookieToken || bearerToken;

  if (!token) {
    res.status(401).json({ error: 'Sesi autentikasi diperlukan. Silakan login terlebih dahulu.' });
    return;
  }

  const decoded = verifySessionToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir.' });
    return;
  }

  const session = db
    .prepare('SELECT id, profile_id, expires_at, revoked_at FROM user_sessions WHERE id = ?')
    .get(decoded.sid) as { id: string; profile_id: string; expires_at: string; revoked_at: string | null } | undefined;

  if (!session || session.revoked_at || session.profile_id !== decoded.sub) {
    res.status(401).json({ error: 'Sesi telah dicabut atau tidak ditemukan.' });
    return;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    res.status(401).json({ error: 'Sesi Anda telah kedaluwarsa. Silakan login ulang.' });
    return;
  }

  const user = db
    .prepare(
      `SELECT p.*, r.name as role_name
       FROM profiles p
       JOIN roles r ON r.code = p.role_code
       WHERE p.id = ? AND p.deleted_at IS NULL`
    )
    .get(session.profile_id) as
    | {
        id: string;
        username: string;
        email: string;
        full_name: string;
        role_code: string;
        role_name: string;
        jabatan: string;
        bio: string;
        avatar_url: string;
        additional_info: string;
        status: string;
        privacy_show_joined: number;
        privacy_show_donations: number;
        joined_at: string | null;
      }
    | undefined;

  if (!user) {
    res.status(401).json({ error: 'Akun tidak ditemukan.' });
    return;
  }

  if (user.status !== 'APPROVED') {
    res.status(403).json({
      error:
        user.status === 'SUSPENDED'
          ? 'Akun Anda sedang ditangguhkan. Akses diblokir.'
          : user.status === 'PENDING'
          ? 'Akun Anda belum disetujui pengurus.'
          : 'Akun Anda tidak memiliki izin akses aktif.',
      accountStatus: user.status,
    });
    return;
  }

  const nowIso = getJakartaNow().iso;
  db.prepare('UPDATE user_sessions SET last_active_at = ? WHERE id = ?').run(nowIso, session.id);

  req.auth = {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    roleCode: user.role_code,
    roleName: user.role_name,
    jabatan: user.jabatan,
    bio: user.bio,
    avatarUrl: user.avatar_url,
    additionalInfo: user.additional_info,
    status: user.status,
    privacyShowJoined: Boolean(user.privacy_show_joined),
    privacyShowDonations: Boolean(user.privacy_show_donations),
    joinedAt: user.joined_at,
    sessionId: session.id,
    permissions: getPermissionsForRole(user.role_code),
  };

  next();
}

function requirePermission(permission: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Autentikasi diperlukan.' });
      return;
    }
    if (!req.auth.permissions.includes(permission) && req.auth.roleCode !== 'CAPSU') {
      res.status(403).json({ error: `Akses ditolak. Diperlukan izin: ${permission}.` });
      return;
    }
    next();
  };
}

function escapeCsvCell(val: unknown): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function registerRoutes(app: Express): void {
  // ==========================================
  // 1. PUBLIC ENDPOINTS
  // ==========================================
  app.get('/api/public/overview', (_req, res) => {
    const settings = getSettingsMap();
    let mission: string[] = [];
    let rules: string[] = [];
    try {
      mission = JSON.parse(settings.mission || '[]');
    } catch {
      mission = [];
    }
    try {
      rules = JSON.parse(settings.rules || '[]');
    } catch {
      rules = [];
    }

    const leadership = db
      .prepare(
        `SELECT p.id, p.full_name, p.username, p.role_code, r.name as role_name, r.rank_order, p.jabatan, p.bio, p.avatar_url
         FROM profiles p
         JOIN roles r ON r.code = p.role_code
         WHERE p.status = 'APPROVED' AND p.deleted_at IS NULL AND p.role_code IN ('CAPSU', 'DEPUTI', 'ADMIN', 'BENDAHARA')
         ORDER BY r.rank_order ASC, p.created_at ASC`
      )
      .all() as Array<{
      id: string;
      full_name: string;
      username: string;
      role_code: string;
      role_name: string;
      rank_order: number;
      jabatan: string;
      bio: string;
      avatar_url: string;
    }>;

    const memberStats = db
      .prepare("SELECT COUNT(*) as totalActive FROM profiles WHERE status = 'APPROVED' AND deleted_at IS NULL")
      .get() as { totalActive: number };

    res.json({
      community: {
        platformName: settings.platform_name || 'WALUH FAMILY',
        fullName: settings.full_name || 'WELLBORN FAMILY',
        tagline: settings.tagline || 'ONE FAMILY. ONE LEGACY.',
        secondaryTagline: settings.secondary_tagline || 'United by Loyalty, Strengthened by Brotherhood.',
        philosophy: settings.philosophy || '',
        vision: settings.vision || '',
        mission,
        rules,
        contactEmail: settings.contact_email || 'council@waluhfamily.org',
        retentionPolicy: settings.retention_policy || '',
      },
      leadership: leadership.map((l) => ({
        id: l.id,
        fullName: l.full_name,
        username: l.username,
        roleCode: l.role_code,
        roleName: l.role_name,
        jabatan: l.jabatan,
        bio: l.bio,
        avatarUrl: l.avatar_url,
      })),
      activeMembersCount: memberStats.totalActive,
      currentJakartaWeek: getCurrentJakartaWeek(),
    });
  });

  // ==========================================
  // 2. AUTHENTICATION & REGISTRATION
  // ==========================================
  app.post('/api/auth/register', (req, res) => {
    try {
      const { fullName, username, email, password, avatarUrl, additionalInfo, rulesAccepted } = req.body ?? {};

      const cleanName = typeof fullName === 'string' ? fullName.trim() : '';
      const cleanUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const cleanPass = typeof password === 'string' ? password : '';
      const cleanInfo = typeof additionalInfo === 'string' ? additionalInfo.trim() : '';

      if (cleanName.length < 3 || cleanName.length > 80) {
        res.status(400).json({ error: 'Nama lengkap minimal 3 karakter dan maksimal 80 karakter.' });
        return;
      }
      if (!/^[a-z0-9_]{3,28}$/.test(cleanUsername)) {
        res.status(400).json({ error: 'Username harus 3–28 karakter (huruf kecil, angka, atau underscore).' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Format email tidak valid.' });
        return;
      }
      if (cleanPass.length < 8) {
        res.status(400).json({ error: 'Password minimal 8 karakter.' });
        return;
      }
      if (rulesAccepted !== true) {
        res.status(400).json({ error: 'Anda wajib menyetujui aturan komunitas WALUH FAMILY.' });
        return;
      }

      const safeAvatar = validateAvatarInput(avatarUrl);

      const dup = db
        .prepare('SELECT id, username, email FROM profiles WHERE username = ? OR email = ?')
        .get(cleanUsername, cleanEmail) as { id: string; username: string; email: string } | undefined;

      if (dup) {
        if (dup.email.toLowerCase() === cleanEmail) {
          res.status(409).json({ error: 'Email sudah terdaftar di sistem.' });
          return;
        }
        res.status(409).json({ error: 'Username sudah digunakan. Pilih username lain.' });
        return;
      }

      const now = getJakartaNow().iso;
      const profileId = generateId('usr');
      const regId = generateId('reg');
      const passwordHash = hashPassword(cleanPass);

      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO profiles (
            id, username, email, password_hash, full_name, role_code, jabatan, bio,
            avatar_url, additional_info, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'MEMBER', 'Calon Anggota', '', ?, ?, 'PENDING', ?, ?)
        `).run(profileId, cleanUsername, cleanEmail, passwordHash, cleanName, safeAvatar, cleanInfo, now, now);

        db.prepare(`
          INSERT INTO registrations (
            id, profile_id, full_name, username, email, additional_info, rules_accepted, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, 'PENDING', ?)
        `).run(regId, profileId, cleanName, cleanUsername, cleanEmail, cleanInfo, now);
      });
      tx();

      notifyRoles(
        ['CAPSU', 'ADMIN'],
        'REGISTRATION_NEW',
        'Pendaftaran Anggota Baru',
        `${cleanName} (@${cleanUsername}) mendaftar dan menunggu verifikasi pengurus.`,
        'registrations'
      );

      writeAuditLog({
        actorId: profileId,
        actorName: cleanName,
        actorRole: 'GUEST_APPLICANT',
        action: 'MEMBER_REGISTERED',
        targetType: 'registration',
        targetId: regId,
        details: { username: cleanUsername, email: cleanEmail },
        ipAddress: getClientIp(req),
      });

      res.status(201).json({
        message: 'Pendaftaran berhasil dikirim. Status akun Anda saat ini PENDING dan menunggu persetujuan pengurus.',
        registration: {
          id: regId,
          username: cleanUsername,
          status: 'PENDING',
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses pendaftaran.';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const { identifier, password, rememberMe } = req.body ?? {};
    const cleanId = typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
    const cleanPass = typeof password === 'string' ? password : '';
    const remember = Boolean(rememberMe);

    if (!cleanId || !cleanPass) {
      res.status(400).json({ error: 'Email/username dan password wajib diisi.' });
      return;
    }

    const user = db
      .prepare(
        `SELECT p.*, r.name as role_name
         FROM profiles p
         JOIN roles r ON r.code = p.role_code
         WHERE (p.email = ? OR p.username = ?) AND p.deleted_at IS NULL`
      )
      .get(cleanId, cleanId) as
      | {
          id: string;
          username: string;
          email: string;
          password_hash: string;
          full_name: string;
          role_code: string;
          role_name: string;
          jabatan: string;
          bio: string;
          avatar_url: string;
          additional_info: string;
          status: string;
          privacy_show_joined: number;
          privacy_show_donations: number;
          joined_at: string | null;
        }
      | undefined;

    if (!user || !verifyPassword(cleanPass, user.password_hash)) {
      res.status(401).json({ error: 'Kredensial tidak valid. Periksa kembali email/username dan password Anda.' });
      return;
    }

    if (user.status === 'PENDING') {
      res.status(403).json({
        error: 'Akun Anda masih berstatus PENDING. Mohon tunggu persetujuan CAPSU atau Admin sebelum mengakses dashboard.',
        accountStatus: 'PENDING',
      });
      return;
    }

    if (user.status === 'REJECTED') {
      res.status(403).json({
        error: 'Pendaftaran akun Anda berstatus REJECTED dan tidak dapat masuk ke platform.',
        accountStatus: 'REJECTED',
      });
      return;
    }

    if (user.status === 'SUSPENDED') {
      res.status(403).json({
        error: 'Akun Anda sedang berstatus SUSPENDED (ditangguhkan). Hubungi CAPSU atau Admin.',
        accountStatus: 'SUSPENDED',
      });
      return;
    }

    if (user.status === 'DELETION_REQUESTED') {
      res.status(403).json({
        error: 'Akun ini telah mengajukan penonaktifan/penghapusan akun.',
        accountStatus: 'DELETION_REQUESTED',
      });
      return;
    }

    const now = getJakartaNow().iso;
    const sessionId = generateId('ses');
    const maxAgeMs = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + maxAgeMs).toISOString();

    db.prepare(`
      INSERT INTO user_sessions (id, profile_id, user_agent, ip_address, remember_me, expires_at, created_at, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      user.id,
      String(req.headers['user-agent'] || '').slice(0, 240),
      getClientIp(req),
      remember ? 1 : 0,
      expiresAt,
      now,
      now
    );

    const token = signSessionToken({ sub: user.id, sid: sessionId }, remember);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: maxAgeMs,
    });

    writeAuditLog({
      actorId: user.id,
      actorName: user.full_name,
      actorRole: user.role_code,
      action: 'AUTH_LOGIN',
      targetType: 'session',
      targetId: sessionId,
      details: { rememberMe: remember },
      ipAddress: getClientIp(req),
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        roleCode: user.role_code,
        roleName: user.role_name,
        jabatan: user.jabatan,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        additionalInfo: user.additional_info,
        status: user.status,
        privacyShowJoined: Boolean(user.privacy_show_joined),
        privacyShowDonations: Boolean(user.privacy_show_donations),
        joinedAt: user.joined_at,
        permissions: getPermissionsForRole(user.role_code),
      },
    });
  });

  app.post('/api/auth/logout', (req: AuthedRequest, res) => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) {
      const decoded = verifySessionToken(token);
      if (decoded) {
        const now = getJakartaNow().iso;
        db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE id = ?').run(now, decoded.sid);
        const actor = db.prepare('SELECT id, full_name, role_code FROM profiles WHERE id = ?').get(decoded.sub) as
          | { id: string; full_name: string; role_code: string }
          | undefined;
        if (actor) {
          writeAuditLog({
            actorId: actor.id,
            actorName: actor.full_name,
            actorRole: actor.role_code,
            action: 'AUTH_LOGOUT',
            targetType: 'session',
            targetId: decoded.sid,
            ipAddress: getClientIp(req),
          });
        }
      }
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ message: 'Logout berhasil.' });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail) {
      res.status(400).json({ error: 'Email wajib diisi.' });
      return;
    }

    const user = db
      .prepare('SELECT id, full_name, role_code, status FROM profiles WHERE email = ? AND deleted_at IS NULL')
      .get(cleanEmail) as { id: string; full_name: string; role_code: string; status: string } | undefined;

    if (!user) {
      // Do not reveal account existence in general message, unless handled cleanly
      res.json({
        message: 'Jika email terdaftar, token pemulihan password telah dibuat (berlaku 30 menit).',
      });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    const now = getJakartaNow().iso;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO password_resets (id, profile_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(generateId('rst'), user.id, token, expiresAt, now);

    writeAuditLog({
      actorId: user.id,
      actorName: user.full_name,
      actorRole: user.role_code,
      action: 'PASSWORD_RESET_REQUESTED',
      targetType: 'profile',
      targetId: user.id,
      ipAddress: getClientIp(req),
    });

    res.json({
      message: 'Token reset password berhasil dibuat (berlaku 30 menit).',
      // Returned in preview/non-SMTP mode so users can complete password reset directly in UI
      resetTokenPreview: process.env.NODE_ENV === 'production' ? undefined : token,
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const { token, newPassword } = req.body ?? {};
    const cleanToken = typeof token === 'string' ? token.trim() : '';
    const cleanPass = typeof newPassword === 'string' ? newPassword : '';

    if (!cleanToken || cleanPass.length < 8) {
      res.status(400).json({ error: 'Token reset dan password baru (minimal 8 karakter) wajib valid.' });
      return;
    }

    const resetRow = db
      .prepare('SELECT id, profile_id, expires_at, used_at FROM password_resets WHERE token = ?')
      .get(cleanToken) as { id: string; profile_id: string; expires_at: string; used_at: string | null } | undefined;

    if (!resetRow || resetRow.used_at || new Date(resetRow.expires_at).getTime() <= Date.now()) {
      res.status(400).json({ error: 'Token reset tidak valid atau sudah kedaluwarsa.' });
      return;
    }

    const user = db.prepare('SELECT id, full_name, role_code FROM profiles WHERE id = ?').get(resetRow.profile_id) as
      | { id: string; full_name: string; role_code: string }
      | undefined;

    if (!user) {
      res.status(404).json({ error: 'Akun tidak ditemukan.' });
      return;
    }

    const now = getJakartaNow().iso;
    const newHash = hashPassword(cleanPass);

    const tx = db.transaction(() => {
      db.prepare('UPDATE profiles SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, user.id);
      db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(now, resetRow.id);
      db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE profile_id = ? AND revoked_at IS NULL').run(now, user.id);
    });
    tx();

    createNotification({
      recipientId: user.id,
      type: 'SECURITY',
      title: 'Password Diperbarui',
      message: 'Password akun Anda baru saja direset dan seluruh sesi lama telah dicabut.',
      linkTab: 'settings',
    });

    writeAuditLog({
      actorId: user.id,
      actorName: user.full_name,
      actorRole: user.role_code,
      action: 'PASSWORD_RESET_COMPLETED',
      targetType: 'profile',
      targetId: user.id,
      ipAddress: getClientIp(req),
    });

    res.json({ message: 'Password berhasil diperbarui. Silakan login menggunakan password baru Anda.' });
  });

  // ==========================================
  // 3. AUTHENTICATED MEMBER SESSION & PROFILE
  // ==========================================
  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const unreadRow = db
      .prepare('SELECT COUNT(*) as cnt FROM notifications WHERE recipient_id = ? AND is_read = 0')
      .get(auth.id) as { cnt: number };

    res.json({
      user: {
        id: auth.id,
        username: auth.username,
        email: auth.email,
        fullName: auth.fullName,
        roleCode: auth.roleCode,
        roleName: auth.roleName,
        jabatan: auth.jabatan,
        bio: auth.bio,
        avatarUrl: auth.avatarUrl,
        additionalInfo: auth.additionalInfo,
        status: auth.status,
        privacyShowJoined: auth.privacyShowJoined,
        privacyShowDonations: auth.privacyShowDonations,
        joinedAt: auth.joinedAt,
        permissions: auth.permissions,
      },
      unreadNotifications: unreadRow.cnt,
    });
  });

  app.get('/api/dashboard/summary', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const currentWeek = getCurrentJakartaWeek();
    const currentMonth = getJakartaNow().date.slice(0, 7);

    const activeMembers = (
      db.prepare("SELECT COUNT(*) as cnt FROM profiles WHERE status = 'APPROVED' AND deleted_at IS NULL").get() as {
        cnt: number;
      }
    ).cnt;

    const pendingRegistrations =
      auth.permissions.includes('registrations.review') || auth.roleCode === 'CAPSU'
        ? (db.prepare("SELECT COUNT(*) as cnt FROM registrations WHERE status = 'PENDING'").get() as { cnt: number }).cnt
        : 0;

    const weekTotal = (
      db
        .prepare("SELECT COALESCE(SUM(amount_coins), 0) as total FROM donations WHERE status = 'VERIFIED' AND week_key = ?")
        .get(currentWeek.weekKey) as { total: number }
    ).total;

    const monthTotal = (
      db
        .prepare("SELECT COALESCE(SUM(amount_coins), 0) as total FROM donations WHERE status = 'VERIFIED' AND month_key = ?")
        .get(currentMonth) as { total: number }
    ).total;

    const allTimeTotal = (
      db.prepare("SELECT COALESCE(SUM(amount_coins), 0) as total FROM donations WHERE status = 'VERIFIED'").get() as {
        total: number;
      }
    ).total;

    const myTotal = (
      db
        .prepare("SELECT COALESCE(SUM(amount_coins), 0) as total FROM donations WHERE status = 'VERIFIED' AND member_id = ?")
        .get(auth.id) as { total: number }
    ).total;

    const latestAnnouncements = db
      .prepare(
        `SELECT a.id, a.title, a.content, a.published_at, p.full_name as author_name
         FROM announcements a
         JOIN profiles p ON p.id = a.author_id
         WHERE a.status = 'PUBLISHED'
         ORDER BY a.published_at DESC
         LIMIT 3`
      )
      .all();

    const upcomingEvents = db
      .prepare(
        `SELECT id, title, event_date, event_time, location, status
         FROM events
         WHERE status IN ('UPCOMING', 'ONGOING')
         ORDER BY event_date ASC
         LIMIT 4`
      )
      .all();

    const recentDonations = db
      .prepare(
        `SELECT d.id, d.tx_code, d.amount_coins, d.donation_date, d.week_key, d.recorded_at,
                m.full_name as member_name, m.username as member_username
         FROM donations d
         JOIN profiles m ON m.id = d.member_id
         WHERE d.status = 'VERIFIED'
         ORDER BY d.recorded_at DESC
         LIMIT 5`
      )
      .all();

    res.json({
      activeMembers,
      pendingRegistrations,
      currentWeek,
      currentMonth,
      donations: {
        weekTotal,
        monthTotal,
        allTimeTotal,
        myTotal,
      },
      latestAnnouncements,
      upcomingEvents,
      recentDonations,
    });
  });

  app.patch('/api/profile/me', requireAuth, (req: AuthedRequest, res) => {
    try {
      const auth = req.auth!;
      const { fullName, username, bio, avatarUrl, additionalInfo, privacyShowJoined, privacyShowDonations } =
        req.body ?? {};

      const cleanName = typeof fullName === 'string' ? fullName.trim() : auth.fullName;
      const cleanUsername = typeof username === 'string' ? username.trim().toLowerCase() : auth.username;
      const cleanBio = typeof bio === 'string' ? bio.trim().slice(0, 500) : auth.bio;
      const cleanInfo = typeof additionalInfo === 'string' ? additionalInfo.trim().slice(0, 500) : auth.additionalInfo;
      const safeAvatar = avatarUrl !== undefined ? validateAvatarInput(avatarUrl) : auth.avatarUrl;

      if (cleanName.length < 3 || cleanName.length > 80) {
        res.status(400).json({ error: 'Nama lengkap harus 3–80 karakter.' });
        return;
      }
      if (!/^[a-z0-9_]{3,28}$/.test(cleanUsername)) {
        res.status(400).json({ error: 'Username harus 3–28 karakter (huruf kecil, angka, underscore).' });
        return;
      }

      if (cleanUsername !== auth.username) {
        const exists = db
          .prepare('SELECT id FROM profiles WHERE username = ? AND id != ?')
          .get(cleanUsername, auth.id);
        if (exists) {
          res.status(409).json({ error: 'Username sudah dipakai anggota lain.' });
          return;
        }
      }

      const now = getJakartaNow().iso;
      db.prepare(`
        UPDATE profiles
        SET full_name = ?, username = ?, bio = ?, avatar_url = ?, additional_info = ?,
            privacy_show_joined = ?, privacy_show_donations = ?, updated_at = ?
        WHERE id = ?
      `).run(
        cleanName,
        cleanUsername,
        cleanBio,
        safeAvatar,
        cleanInfo,
        privacyShowJoined === undefined ? (auth.privacyShowJoined ? 1 : 0) : privacyShowJoined ? 1 : 0,
        privacyShowDonations === undefined ? (auth.privacyShowDonations ? 1 : 0) : privacyShowDonations ? 1 : 0,
        now,
        auth.id
      );

      writeAuditLog({
        actorId: auth.id,
        actorName: cleanName,
        actorRole: auth.roleCode,
        action: 'PROFILE_SELF_UPDATED',
        targetType: 'profile',
        targetId: auth.id,
        ipAddress: getClientIp(req),
      });

      res.json({ message: 'Profil berhasil diperbarui.' });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui profil.' });
    }
  });

  app.post('/api/profile/change-password', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ error: 'Password saat ini dan password baru (min 8 karakter) wajib diisi.' });
      return;
    }

    const row = db.prepare('SELECT password_hash FROM profiles WHERE id = ?').get(auth.id) as { password_hash: string };
    if (!verifyPassword(currentPassword, row.password_hash)) {
      res.status(400).json({ error: 'Password saat ini tidak sesuai.' });
      return;
    }

    const now = getJakartaNow().iso;
    db.prepare('UPDATE profiles SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      hashPassword(newPassword),
      now,
      auth.id
    );

    createNotification({
      recipientId: auth.id,
      type: 'SECURITY',
      title: 'Password Diubah',
      message: 'Password akun Anda baru saja diperbarui.',
      linkTab: 'settings',
    });

    writeAuditLog({
      actorId: auth.id,
      actorName: auth.fullName,
      actorRole: auth.roleCode,
      action: 'PASSWORD_CHANGED',
      targetType: 'profile',
      targetId: auth.id,
      ipAddress: getClientIp(req),
    });

    res.json({ message: 'Password berhasil diubah.' });
  });

  app.get('/api/sessions', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const rows = db
      .prepare(
        `SELECT id, user_agent, ip_address, remember_me, expires_at, created_at, last_active_at
         FROM user_sessions
         WHERE profile_id = ? AND revoked_at IS NULL
         ORDER BY last_active_at DESC`
      )
      .all(auth.id) as Array<{
      id: string;
      user_agent: string;
      ip_address: string;
      remember_me: number;
      expires_at: string;
      created_at: string;
      last_active_at: string;
    }>;

    res.json({
      sessions: rows.map((s) => ({
        id: s.id,
        userAgent: s.user_agent,
        ipAddress: s.ip_address,
        rememberMe: Boolean(s.remember_me),
        expiresAt: s.expires_at,
        createdAt: s.created_at,
        lastActiveAt: s.last_active_at,
        isCurrent: s.id === auth.sessionId,
      })),
    });
  });

  app.post('/api/sessions/revoke-all', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const now = getJakartaNow().iso;
    db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE profile_id = ? AND revoked_at IS NULL').run(now, auth.id);

    writeAuditLog({
      actorId: auth.id,
      actorName: auth.fullName,
      actorRole: auth.roleCode,
      action: 'SESSIONS_REVOKED_ALL',
      targetType: 'profile',
      targetId: auth.id,
      ipAddress: getClientIp(req),
    });

    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ message: 'Seluruh sesi di semua perangkat telah dikeluarkan.' });
  });

  app.post('/api/profile/request-deletion', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const { password, confirmationPhrase } = req.body ?? {};

    if (auth.roleCode === 'CAPSU') {
      const capsuCount = (
        db.prepare("SELECT COUNT(*) as cnt FROM profiles WHERE role_code = 'CAPSU' AND status = 'APPROVED'").get() as {
          cnt: number;
        }
      ).cnt;
      if (capsuCount <= 1) {
        res.status(400).json({
          error: 'CAPSU tunggal tidak dapat menghapus akun sebelum melantik CAPSU pengganti.',
        });
        return;
      }
    }

    if (confirmationPhrase !== 'HAPUS AKUN SAYA') {
      res.status(400).json({ error: 'Ketik tepat "HAPUS AKUN SAYA" untuk konfirmasi penghapusan.' });
      return;
    }

    const row = db.prepare('SELECT password_hash FROM profiles WHERE id = ?').get(auth.id) as { password_hash: string };
    if (typeof password !== 'string' || !verifyPassword(password, row.password_hash)) {
      res.status(400).json({ error: 'Password konfirmasi salah.' });
      return;
    }

    const now = getJakartaNow().iso;
    const tx = db.transaction(() => {
      // Financial retention policy: preserve profile row & donation records, revoke sessions & anonymize personal auth
      db.prepare("UPDATE profiles SET status = 'DELETION_REQUESTED', updated_at = ? WHERE id = ?").run(now, auth.id);
      db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE profile_id = ? AND revoked_at IS NULL').run(
        now,
        auth.id
      );
    });
    tx();

    notifyRoles(
      ['CAPSU'],
      'ACCOUNT_DELETION',
      'Permintaan Penonaktifan Akun',
      `${auth.fullName} (@${auth.username}) mengonfirmasi penonaktifan akun. Catatan transaksi keuangan dipertahankan sesuai kebijakan retensi.`,
      'members'
    );

    writeAuditLog({
      actorId: auth.id,
      actorName: auth.fullName,
      actorRole: auth.roleCode,
      action: 'ACCOUNT_DELETION_CONFIRMED',
      targetType: 'profile',
      targetId: auth.id,
      details: { financialRecordsRetained: true },
      ipAddress: getClientIp(req),
    });

    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({
      message: 'Akun Anda telah dinonaktifkan. Catatan transaksi donasi historis tetap dipertahankan sesuai kebijakan retensi audit.',
    });
  });

  // ==========================================
  // 4. DIRECTORY & ORGANIZATION STRUCTURE
  // ==========================================
  app.get('/api/directory', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const canManage = auth.permissions.includes('members.manage') || auth.roleCode === 'CAPSU';
    const includeNonActive = canManage && req.query.includeAll === 'true';

    const rows = db
      .prepare(
        `SELECT p.id, p.username, p.full_name, p.role_code, r.name as role_name, r.rank_order,
                p.jabatan, p.bio, p.avatar_url, p.status, p.privacy_show_joined, p.joined_at, p.created_at,
                ${canManage ? 'p.email, p.additional_info,' : ''}
                (SELECT COALESCE(SUM(d.amount_coins), 0) FROM donations d WHERE d.member_id = p.id AND d.status = 'VERIFIED') as total_donations
         FROM profiles p
         JOIN roles r ON r.code = p.role_code
         WHERE p.deleted_at IS NULL ${includeNonActive ? '' : "AND p.status = 'APPROVED'"}
         ORDER BY r.rank_order ASC, p.full_name ASC`
      )
      .all() as Array<Record<string, unknown>>;

    res.json({
      members: rows.map((m) => ({
        id: m.id,
        username: m.username,
        fullName: m.full_name,
        roleCode: m.role_code,
        roleName: m.role_name,
        jabatan: m.jabatan,
        bio: m.bio,
        avatarUrl: m.avatar_url,
        status: m.status,
        joinedAt: canManage || m.privacy_show_joined ? m.joined_at : null,
        email: canManage ? m.email : undefined,
        additionalInfo: canManage ? m.additional_info : undefined,
        totalDonations: m.total_donations,
      })),
    });
  });

  app.get('/api/organization', requireAuth, (_req, res) => {
    const roles = db.prepare('SELECT code, name, rank_order, description FROM roles ORDER BY rank_order ASC').all() as Array<{
      code: string;
      name: string;
      rank_order: number;
      description: string;
    }>;

    const members = db
      .prepare(
        `SELECT id, username, full_name, role_code, jabatan, bio, avatar_url, joined_at
         FROM profiles
         WHERE status = 'APPROVED' AND deleted_at IS NULL
         ORDER BY full_name ASC`
      )
      .all() as Array<{
      id: string;
      username: string;
      full_name: string;
      role_code: string;
      jabatan: string;
      bio: string;
      avatar_url: string;
      joined_at: string | null;
    }>;

    res.json({
      structure: roles.map((r) => ({
        roleCode: r.code,
        roleName: r.name,
        rankOrder: r.rank_order,
        description: r.description,
        members: members
          .filter((m) => m.role_code === r.code)
          .map((m) => ({
            id: m.id,
            username: m.username,
            fullName: m.full_name,
            jabatan: m.jabatan,
            bio: m.bio,
            avatarUrl: m.avatar_url,
            joinedAt: m.joined_at,
          })),
      })),
    });
  });

  // ==========================================
  // 5. DONATION TRANSPARENCY (PUBLIC TO LOGGED-IN MEMBERS)
  // ==========================================
  app.get('/api/donations/transparency', requireAuth, (req: AuthedRequest, res) => {
    const currentWeek = getCurrentJakartaWeek();
    const currentMonth = getJakartaNow().date.slice(0, 7);
    const filterWeek = typeof req.query.weekKey === 'string' && req.query.weekKey ? req.query.weekKey : '';
    const filterMonth = typeof req.query.monthKey === 'string' && req.query.monthKey ? req.query.monthKey : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    // Single source of truth: verified donations only, ZERO sensitive personal fields
    const allVerified = db
      .prepare(
        `SELECT d.id, d.tx_code, d.member_id, d.amount_coins, d.donation_date,
                d.week_key, d.week_start, d.week_end, d.month_key, d.notes, d.recorded_at,
                m.full_name as member_name, m.username as member_username, m.avatar_url as member_avatar
         FROM donations d
         JOIN profiles m ON m.id = d.member_id
         WHERE d.status = 'VERIFIED'
         ORDER BY d.donation_date DESC, d.recorded_at DESC`
      )
      .all() as Array<{
      id: string;
      tx_code: string;
      member_id: string;
      amount_coins: number;
      donation_date: string;
      week_key: string;
      week_start: string;
      week_end: string;
      month_key: string;
      notes: string;
      recorded_at: string;
      member_name: string;
      member_username: string;
      member_avatar: string;
    }>;

    let currentWeekTotal = 0;
    let currentMonthTotal = 0;
    let allTimeTotal = 0;

    const weekMap = new Map<string, { weekKey: string; weekStart: string; weekEnd: string; totalCoins: number; txCount: number }>();
    const monthMap = new Map<string, { monthKey: string; totalCoins: number; txCount: number }>();
    const memberTotals = new Map<
      string,
      {
        memberId: string;
        memberName: string;
        memberUsername: string;
        memberAvatar: string;
        currentWeekCoins: number;
        currentMonthCoins: number;
        allTimeCoins: number;
        txCount: number;
      }
    >();

    for (const tx of allVerified) {
      allTimeTotal += tx.amount_coins;
      if (tx.week_key === currentWeek.weekKey) currentWeekTotal += tx.amount_coins;
      if (tx.month_key === currentMonth) currentMonthTotal += tx.amount_coins;

      const wEntry = weekMap.get(tx.week_key) ?? {
        weekKey: tx.week_key,
        weekStart: tx.week_start,
        weekEnd: tx.week_end,
        totalCoins: 0,
        txCount: 0,
      };
      wEntry.totalCoins += tx.amount_coins;
      wEntry.txCount += 1;
      weekMap.set(tx.week_key, wEntry);

      const mEntry = monthMap.get(tx.month_key) ?? {
        monthKey: tx.month_key,
        totalCoins: 0,
        txCount: 0,
      };
      mEntry.totalCoins += tx.amount_coins;
      mEntry.txCount += 1;
      monthMap.set(tx.month_key, mEntry);

      const memEntry = memberTotals.get(tx.member_id) ?? {
        memberId: tx.member_id,
        memberName: tx.member_name,
        memberUsername: tx.member_username,
        memberAvatar: tx.member_avatar,
        currentWeekCoins: 0,
        currentMonthCoins: 0,
        allTimeCoins: 0,
        txCount: 0,
      };
      memEntry.allTimeCoins += tx.amount_coins;
      if (tx.week_key === currentWeek.weekKey) memEntry.currentWeekCoins += tx.amount_coins;
      if (tx.month_key === currentMonth) memEntry.currentMonthCoins += tx.amount_coins;
      memEntry.txCount += 1;
      memberTotals.set(tx.member_id, memEntry);
    }

    const filteredTransactions = allVerified.filter((tx) => {
      if (filterWeek && tx.week_key !== filterWeek) return false;
      if (filterMonth && tx.month_key !== filterMonth) return false;
      if (
        search &&
        !tx.member_name.toLowerCase().includes(search) &&
        !tx.member_username.toLowerCase().includes(search) &&
        !tx.tx_code.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    });

    res.json({
      currentWeek,
      currentMonth,
      totals: {
        currentWeekTotal,
        currentMonthTotal,
        allTimeTotal,
        transactionCount: allVerified.length,
      },
      weeklyHistory: Array.from(weekMap.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
      monthlyHistory: Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
      memberRecap: Array.from(memberTotals.values()).sort((a, b) => b.allTimeCoins - a.allTimeCoins),
      transactions: filteredTransactions.map((t) => ({
        id: t.id,
        txCode: t.tx_code,
        memberId: t.member_id,
        memberName: t.member_name,
        memberUsername: t.member_username,
        amountCoins: t.amount_coins,
        donationDate: t.donation_date,
        weekKey: t.week_key,
        weekStart: t.week_start,
        weekEnd: t.week_end,
        monthKey: t.month_key,
        notes: t.notes,
        recordedAt: t.recorded_at,
      })),
    });
  });

  app.get('/api/donations/my', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const currentWeek = getCurrentJakartaWeek();
    const currentMonth = getJakartaNow().date.slice(0, 7);

    const rows = db
      .prepare(
        `SELECT d.id, d.tx_code, d.amount_coins, d.donation_date, d.week_key, d.week_start, d.week_end,
                d.month_key, d.notes, d.status, d.recorded_at, rec.full_name as treasurer_name
         FROM donations d
         JOIN profiles rec ON rec.id = d.recorded_by
         WHERE d.member_id = ?
         ORDER BY d.donation_date DESC, d.recorded_at DESC`
      )
      .all(auth.id) as Array<{
      id: string;
      tx_code: string;
      amount_coins: number;
      donation_date: string;
      week_key: string;
      week_start: string;
      week_end: string;
      month_key: string;
      notes: string;
      status: string;
      recorded_at: string;
      treasurer_name: string;
    }>;

    let weekCoins = 0;
    let monthCoins = 0;
    let totalCoins = 0;
    for (const r of rows) {
      if (r.status !== 'VERIFIED') continue;
      totalCoins += r.amount_coins;
      if (r.week_key === currentWeek.weekKey) weekCoins += r.amount_coins;
      if (r.month_key === currentMonth) monthCoins += r.amount_coins;
    }

    res.json({
      summary: { weekCoins, monthCoins, totalCoins, currentWeek, currentMonth },
      history: rows,
    });
  });

  // ==========================================
  // 6. TREASURER (BENDAHARA) DASHBOARD ENDPOINTS
  // ==========================================
  app.get('/api/treasurer/members', requireAuth, requirePermission('donations.view_all'), (_req, res) => {
    const members = db
      .prepare(
        `SELECT id, full_name, username, role_code, jabatan, status
         FROM profiles
         WHERE deleted_at IS NULL AND status = 'APPROVED'
         ORDER BY full_name ASC`
      )
      .all();
    res.json({ members });
  });

  app.post('/api/treasurer/donations', requireAuth, requirePermission('donations.create'), (req: AuthedRequest, res) => {
    try {
      const auth = req.auth!;
      const { memberId, amountCoins, donationDate, notes, idempotencyKey } = req.body ?? {};

      const cleanMemberId = typeof memberId === 'string' ? memberId.trim() : '';
      const parsedAmount = Number(amountCoins);
      const cleanDate = typeof donationDate === 'string' ? donationDate.trim() : '';
      const cleanNotes = typeof notes === 'string' ? notes.trim().slice(0, 400) : '';
      const cleanIdemp = typeof idempotencyKey === 'string' && idempotencyKey.trim() ? idempotencyKey.trim() : null;

      if (!cleanMemberId) {
        res.status(400).json({ error: 'Anggota wajib dipilih dari database.' });
        return;
      }
      if (!Number.isInteger(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100_000_000) {
        res.status(400).json({ error: 'Jumlah donasi koin harus berupa bilangan bulat positif.' });
        return;
      }

      const period = getMondaySundayWeekPeriod(cleanDate);

      if (cleanIdemp) {
        const dup = db.prepare('SELECT id, tx_code FROM donations WHERE idempotency_key = ?').get(cleanIdemp) as
          | { id: string; tx_code: string }
          | undefined;
        if (dup) {
          res.status(200).json({ message: 'Transaksi sudah tersimpan sebelumnya.', duplicatePrevented: true, txCode: dup.tx_code });
          return;
        }
      }

      const member = db
        .prepare("SELECT id, full_name, username, status FROM profiles WHERE id = ? AND deleted_at IS NULL")
        .get(cleanMemberId) as { id: string; full_name: string; username: string; status: string } | undefined;

      if (!member) {
        res.status(404).json({ error: 'Anggota tidak ditemukan dalam database.' });
        return;
      }

      const now = getJakartaNow().iso;
      const donationId = generateId('don');
      const txCode = generateTxCode(cleanDate);

      db.prepare(`
        INSERT INTO donations (
          id, tx_code, member_id, amount_coins, donation_date, week_key, week_start, week_end,
          month_key, notes, status, recorded_by, idempotency_key, recorded_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, ?, ?, ?)
      `).run(
        donationId,
        txCode,
        member.id,
        parsedAmount,
        cleanDate,
        period.weekKey,
        period.weekStart,
        period.weekEnd,
        period.monthKey,
        cleanNotes,
        auth.id,
        cleanIdemp,
        now,
        now
      );

      createNotification({
        recipientId: member.id,
        type: 'DONATION_RECORDED',
        title: 'Donasi Koin Tercatat',
        message: `Donasi sebesar ${parsedAmount.toLocaleString('id-ID')} koin (${cleanDate}, periode ${period.weekKey}) telah dicatat oleh ${auth.fullName}.`,
        linkTab: 'donations',
      });

      writeAuditLog({
        actorId: auth.id,
        actorName: auth.fullName,
        actorRole: auth.roleCode,
        action: 'DONATION_RECORDED',
        targetType: 'donation',
        targetId: donationId,
        details: {
          txCode,
          memberId: member.id,
          memberName: member.full_name,
          amountCoins: parsedAmount,
          donationDate: cleanDate,
          weekKey: period.weekKey,
          monthKey: period.monthKey,
        },
        ipAddress: getClientIp(req),
      });

      res.status(201).json({
        message: 'Donasi berhasil disimpan dan langsung terpublikasi ke halaman Donation Transparency.',
        donation: {
          id: donationId,
          txCode,
          memberName: member.full_name,
          amountCoins: parsedAmount,
          donationDate: cleanDate,
          period,
        },
      });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan donasi.' });
    }
  });

  app.get('/api/treasurer/donations', requireAuth, requirePermission('donations.view_all'), (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : '';
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : '';
    const weekKey = typeof req.query.weekKey === 'string' ? req.query.weekKey.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'ALL';
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize) || 15));

    const where: string[] = ['1=1'];
    const params: Array<string | number> = [];

    if (search) {
      where.push('(LOWER(m.full_name) LIKE ? OR LOWER(m.username) LIKE ? OR LOWER(d.tx_code) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (startDate) {
      where.push('d.donation_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      where.push('d.donation_date <= ?');
      params.push(endDate);
    }
    if (weekKey) {
      where.push('d.week_key = ?');
      params.push(weekKey);
    }
    if (status === 'VERIFIED' || status === 'REVERSED') {
      where.push('d.status = ?');
      params.push(status);
    }

    const whereClause = where.join(' AND ');
    const countRow = db
      .prepare(
        `SELECT COUNT(*) as total
         FROM donations d
         JOIN profiles m ON m.id = d.member_id
         WHERE ${whereClause}`
      )
      .get(...params) as { total: number };

    const rows = db
      .prepare(
        `SELECT d.*, m.full_name as member_name, m.username as member_username,
                rec.full_name as treasurer_name
         FROM donations d
         JOIN profiles m ON m.id = d.member_id
         JOIN profiles rec ON rec.id = d.recorded_by
         WHERE ${whereClause}
         ORDER BY d.recorded_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, pageSize, (page - 1) * pageSize) as Array<Record<string, unknown>>;

    const adjustmentsStmt = db.prepare(
      `SELECT da.*, p.full_name as adjusted_by_name
       FROM donation_adjustments da
       JOIN profiles p ON p.id = da.adjusted_by
       WHERE da.donation_id = ?
       ORDER BY da.created_at DESC`
    );

    const enriched = rows.map((r) => ({
      ...r,
      adjustments: adjustmentsStmt.all(r.id),
    }));

    const currentWeek = getCurrentJakartaWeek();
    const currentMonth = getJakartaNow().date.slice(0, 7);

    const stats = {
      weekTotal: (
        db
          .prepare("SELECT COALESCE(SUM(amount_coins), 0) as v FROM donations WHERE status = 'VERIFIED' AND week_key = ?")
          .get(currentWeek.weekKey) as { v: number }
      ).v,
      monthTotal: (
        db
          .prepare("SELECT COALESCE(SUM(amount_coins), 0) as v FROM donations WHERE status = 'VERIFIED' AND month_key = ?")
          .get(currentMonth) as { v: number }
      ).v,
      allTimeTotal: (
        db.prepare("SELECT COALESCE(SUM(amount_coins), 0) as v FROM donations WHERE status = 'VERIFIED'").get() as {
          v: number;
        }
      ).v,
      verifiedCount: (
        db.prepare("SELECT COUNT(*) as v FROM donations WHERE status = 'VERIFIED'").get() as { v: number }
      ).v,
      reversedCount: (
        db.prepare("SELECT COUNT(*) as v FROM donations WHERE status = 'REVERSED'").get() as { v: number }
      ).v,
      currentWeek,
      currentMonth,
    };

    res.json({
      stats,
      pagination: {
        page,
        pageSize,
        total: countRow.total,
        totalPages: Math.max(1, Math.ceil(countRow.total / pageSize)),
      },
      transactions: enriched,
    });
  });

  app.post(
    '/api/treasurer/donations/:id/reverse',
    requireAuth,
    requirePermission('donations.adjust'),
    (req: AuthedRequest, res) => {
      try {
        const auth = req.auth!;
        const donationId = req.params.id;
        const { reason, correctedAmountCoins, correctedDate, correctedNotes } = req.body ?? {};

        const cleanReason = typeof reason === 'string' ? reason.trim() : '';
        if (cleanReason.length < 5) {
          res.status(400).json({ error: 'Alasan koreksi/pembatalan wajib diisi minimal 5 karakter.' });
          return;
        }

        const existing = db.prepare('SELECT * FROM donations WHERE id = ?').get(donationId) as
          | {
              id: string;
              tx_code: string;
              member_id: string;
              amount_coins: number;
              donation_date: string;
              week_key: string;
              notes: string;
              status: string;
            }
          | undefined;

        if (!existing) {
          res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
          return;
        }
        if (existing.status === 'REVERSED') {
          res.status(400).json({ error: 'Transaksi ini sudah dibatalkan/dikoreksi sebelumnya.' });
          return;
        }

        const hasReplacement =
          correctedAmountCoins !== undefined && correctedAmountCoins !== null && String(correctedAmountCoins).trim() !== '';

        let newAmount = 0;
        let replacementDate = existing.donation_date;
        let replacementPeriod = getMondaySundayWeekPeriod(replacementDate);

        if (hasReplacement) {
          newAmount = Number(correctedAmountCoins);
          if (!Number.isInteger(newAmount) || newAmount <= 0) {
            res.status(400).json({ error: 'Jumlah koin koreksi harus bilangan bulat positif.' });
            return;
          }
          if (typeof correctedDate === 'string' && correctedDate.trim()) {
            replacementDate = correctedDate.trim();
            replacementPeriod = getMondaySundayWeekPeriod(replacementDate);
          }
        }

        const now = getJakartaNow().iso;
        const adjId = generateId('adj');
        let replacementId: string | null = null;
        let replacementTxCode: string | null = null;

        const tx = db.transaction(() => {
          db.prepare("UPDATE donations SET status = 'REVERSED', updated_at = ? WHERE id = ?").run(now, existing.id);

          if (hasReplacement) {
            replacementId = generateId('don');
            replacementTxCode = generateTxCode(replacementDate);
            const finalNotes =
              typeof correctedNotes === 'string' && correctedNotes.trim()
                ? correctedNotes.trim()
                : `Koreksi dari ${existing.tx_code}: ${cleanReason}`;

            db.prepare(`
              INSERT INTO donations (
                id, tx_code, member_id, amount_coins, donation_date, week_key, week_start, week_end,
                month_key, notes, status, recorded_by, recorded_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, ?, ?)
            `).run(
              replacementId,
              replacementTxCode,
              existing.member_id,
              newAmount,
              replacementDate,
              replacementPeriod.weekKey,
              replacementPeriod.weekStart,
              replacementPeriod.weekEnd,
              replacementPeriod.monthKey,
              finalNotes,
              auth.id,
              now,
              now
            );
          }

          db.prepare(`
            INSERT INTO donation_adjustments (
              id, donation_id, action_type, previous_amount, new_amount, replacement_donation_id, reason, adjusted_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            adjId,
            existing.id,
            hasReplacement ? 'CORRECTION' : 'REVERSAL',
            existing.amount_coins,
            hasReplacement ? newAmount : 0,
            replacementId,
            cleanReason,
            auth.id,
            now
          );
        });
        tx();

        createNotification({
          recipientId: existing.member_id,
          type: 'DONATION_ADJUSTED',
          title: hasReplacement ? 'Koreksi Transaksi Donasi' : 'Pembatalan Transaksi Donasi',
          message: hasReplacement
            ? `Transaksi ${existing.tx_code} dikoreksi dari ${existing.amount_coins} menjadi ${newAmount} koin (${replacementTxCode}). Alasan: ${cleanReason}`
            : `Transaksi ${existing.tx_code} (${existing.amount_coins} koin) dibatalkan melalui reversal audit. Alasan: ${cleanReason}`,
          linkTab: 'donations',
        });

        writeAuditLog({
          actorId: auth.id,
          actorName: auth.fullName,
          actorRole: auth.roleCode,
          action: hasReplacement ? 'DONATION_CORRECTED' : 'DONATION_REVERSED',
          targetType: 'donation',
          targetId: existing.id,
          details: {
            txCode: existing.tx_code,
            previousAmount: existing.amount_coins,
            newAmount: hasReplacement ? newAmount : 0,
            replacementTxCode,
          },
          reason: cleanReason,
          ipAddress: getClientIp(req),
        });

        res.json({
          message: hasReplacement
            ? `Transaksi ${existing.tx_code} berhasil direversal dan diganti dengan ${replacementTxCode}.`
            : `Transaksi ${existing.tx_code} berhasil direversal dengan catatan audit.`,
        });
      } catch (err: unknown) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal mengoreksi transaksi.' });
      }
    }
  );

  app.get('/api/treasurer/reports/export.csv', requireAuth, requirePermission('donations.export'), (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const rows = db
      .prepare(
        `SELECT d.tx_code, m.full_name as member_name, m.username as member_username,
                d.amount_coins, d.donation_date, d.week_key, d.week_start, d.week_end,
                d.month_key, d.status, d.notes, d.recorded_at, rec.full_name as treasurer_name
         FROM donations d
         JOIN profiles m ON m.id = d.member_id
         JOIN profiles rec ON rec.id = d.recorded_by
         ORDER BY d.donation_date DESC, d.recorded_at DESC`
      )
      .all() as Array<Record<string, unknown>>;

    const headers = [
      'ID Transaksi',
      'Nama Anggota',
      'Username',
      'Jumlah Koin',
      'Tanggal Donasi',
      'Periode Minggu',
      'Mulai Minggu (Senin)',
      'Akhir Minggu (Minggu)',
      'Bulan',
      'Status',
      'Catatan',
      'Waktu Pencatatan',
      'Bendahara Pencatat',
    ];

    const lines = [headers.map(escapeCsvCell).join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.tx_code,
          r.member_name,
          r.member_username,
          r.amount_coins,
          r.donation_date,
          r.week_key,
          r.week_start,
          r.week_end,
          r.month_key,
          r.status,
          r.notes,
          r.recorded_at,
          r.treasurer_name,
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }

    writeAuditLog({
      actorId: auth.id,
      actorName: auth.fullName,
      actorRole: auth.roleCode,
      action: 'DONATION_REPORT_EXPORTED_CSV',
      targetType: 'report',
      targetId: 'donations_csv',
      details: { rowCount: rows.length },
      ipAddress: getClientIp(req),
    });

    const today = getJakartaNow().date;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="waluh-family-donations-${today}.csv"`);
    res.send('\uFEFF' + lines.join('\r\n'));
  });

  // ==========================================
  // 7. EVENTS & RSVP
  // ==========================================
  app.get('/api/events', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const events = db
      .prepare(
        `SELECT e.*, p.full_name as creator_name
         FROM events e
         JOIN profiles p ON p.id = e.created_by
         ORDER BY e.event_date DESC, e.created_at DESC`
      )
      .all() as Array<Record<string, unknown>>;

    const attendeesStmt = db.prepare(
      `SELECT ea.profile_id, ea.rsvp_status, ea.responded_at, p.full_name, p.username, p.avatar_url
       FROM event_attendees ea
       JOIN profiles p ON p.id = ea.profile_id
       WHERE ea.event_id = ?
       ORDER BY ea.responded_at DESC`
    );

    const enriched = events.map((ev) => {
      const attendees = attendeesStmt.all(ev.id) as Array<{
        profile_id: string;
        rsvp_status: string;
        responded_at: string;
        full_name: string;
        username: string;
        avatar_url: string;
      }>;
      const myRsvp = attendees.find((a) => a.profile_id === auth.id)?.rsvp_status || null;
      return {
        ...ev,
        rsvpEnabled: Boolean(ev.rsvp_enabled),
        myRsvp,
        goingCount: attendees.filter((a) => a.rsvp_status === 'GOING').length,
        attendees,
      };
    });

    res.json({ events: enriched });
  });

  app.post('/api/events', requireAuth, requirePermission('events.manage'), (req: AuthedRequest, res) => {
    try {
      const auth = req.auth!;
      const { title, description, eventDate, eventTime, location, posterUrl, status, rsvpEnabled } = req.body ?? {};
      const cleanTitle = typeof title === 'string' ? title.trim() : '';
      const cleanDesc = typeof description === 'string' ? description.trim() : '';
      const cleanDate = typeof eventDate === 'string' ? eventDate.trim() : '';
      const cleanTime = typeof eventTime === 'string' ? eventTime.trim() : '';
      const cleanLoc = typeof location === 'string' ? location.trim() : '';
      const safePoster = posterUrl ? validateAvatarInput(posterUrl) : '';
      const allowedStatuses = ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'];
      const cleanStatus = allowedStatuses.includes(status) ? status : 'UPCOMING';

      if (cleanTitle.length < 3 || !cleanDate || !cleanLoc) {
        res.status(400).json({ error: 'Judul event, tanggal, dan lokasi wajib diisi.' });
        return;
      }

      const now = getJakartaNow().iso;
      const id = generateId('evt');
      db.prepare(`
        INSERT INTO events (id, title, description, event_date, event_time, location, poster_url, status, rsvp_enabled, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, cleanTitle, cleanDesc, cleanDate, cleanTime, cleanLoc, safePoster, cleanStatus, rsvpEnabled === false ? 0 : 1, auth.id, now, now);

      notifyAllApprovedMembers(
        'EVENT_CREATED',
        'Event Baru Komunitas',
        `${cleanTitle} pada ${cleanDate}${cleanTime ? ` pukul ${cleanTime}` : ''} di ${cleanLoc}.`,
        'events'
      );

      writeAuditLog({
        actorId: auth.id,
        actorName: auth.fullName,
        actorRole: auth.roleCode,
        action: 'EVENT_CREATED',
        targetType: 'event',
        targetId: id,
        details: { title: cleanTitle, eventDate: cleanDate },
        ipAddress: getClientIp(req),
      });

      res.status(201).json({ message: 'Event berhasil dibuat.', id });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal membuat event.' });
    }
  });

  app.patch('/api/events/:id', requireAuth, requirePermission('events.manage'), (req: AuthedRequest, res) => {
    try {
      const auth = req.auth!;
      const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id) as
        | { id: string; title: string; event_date: string; event_time: string; location: string; status: string }
        | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Event tidak ditemukan.' });
        return;
      }

      const { title, description, eventDate, eventTime, location, status, rsvpEnabled } = req.body ?? {};
      const now = getJakartaNow().iso;
      const allowedStatuses = ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'];
      const nextStatus = allowedStatuses.includes(status) ? status : existing.status;

      db.prepare(`
        UPDATE events
        SET title = COALESCE(?, title),
            description = COALESCE(?, description),
            event_date = COALESCE(?, event_date),
            event_time = COALESCE(?, event_time),
            location = COALESCE(?, location),
            status = ?,
            rsvp_enabled = COALESCE(?, rsvp_enabled),
            updated_at = ?
        WHERE id = ?
      `).run(
        typeof title === 'string' ? title.trim() : null,
        typeof description === 'string' ? description.trim() : null,
        typeof eventDate === 'string' ? eventDate.trim() : null,
        typeof eventTime === 'string' ? eventTime.trim() : null,
        typeof location === 'string' ? location.trim() : null,
        nextStatus,
        rsvpEnabled === undefined ? null : rsvpEnabled ? 1 : 0,
        now,
        existing.id
      );

      notifyAllApprovedMembers(
        'EVENT_UPDATED',
        'Pembaruan Jadwal Event',
        `Event "${title || existing.title}" telah diperbarui oleh pengurus (Status: ${nextStatus}).`,
        'events'
      );

      writeAuditLog({
        actorId: auth.id,
        actorName: auth.fullName,
        actorRole: auth.roleCode,
        action: 'EVENT_UPDATED',
        targetType: 'event',
        targetId: existing.id,
        details: { status: nextStatus },
        ipAddress: getClientIp(req),
      });

      res.json({ message: 'Event berhasil diperbarui.' });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui event.' });
    }
  });

  app.post('/api/events/:id/rsvp', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const { rsvpStatus } = req.body ?? {};
    if (!['GOING', 'MAYBE', 'DECLINED'].includes(rsvpStatus)) {
      res.status(400).json({ error: 'Status RSVP tidak valid.' });
      return;
    }

    const evt = db.prepare('SELECT id, rsvp_enabled FROM events WHERE id = ?').get(req.params.id) as
      | { id: string; rsvp_enabled: number }
      | undefined;
    if (!evt) {
      res.status(404).json({ error: 'Event tidak ditemukan.' });
      return;
    }
    if (!evt.rsvp_enabled) {
      res.status(400).json({ error: 'Konfirmasi kehadiran untuk event ini tidak diaktifkan.' });
      return;
    }

    const now = getJakartaNow().iso;
    db.prepare(`
      INSERT INTO event_attendees (id, event_id, profile_id, rsvp_status, responded_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(event_id, profile_id) DO UPDATE SET rsvp_status = excluded.rsvp_status, responded_at = excluded.responded_at
    `).run(generateId('rsvp'), evt.id, auth.id, rsvpStatus, now);

    res.json({ message: 'Konfirmasi kehadiran disimpan.' });
  });

  // ==========================================
  // 8. ANNOUNCEMENTS
  // ==========================================
  app.get('/api/announcements', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const canManage = auth.permissions.includes('announcements.manage') || auth.roleCode === 'CAPSU';
    const rows = db
      .prepare(
        `SELECT a.*, p.full_name as author_name, p.role_code as author_role
         FROM announcements a
         JOIN profiles p ON p.id = a.author_id
         ${canManage ? '' : "WHERE a.status = 'PUBLISHED'"}
         ORDER BY a.created_at DESC`
      )
      .all();

    res.json({ announcements: rows });
  });

  app.post('/api/announcements', requireAuth, requirePermission('announcements.manage'), (req: AuthedRequest, res) => {
    try {
      const auth = req.auth!;
      const { title, content, imageUrl, status } = req.body ?? {};
      const cleanTitle = typeof title === 'string' ? title.trim() : '';
      const cleanContent = typeof content === 'string' ? content.trim() : '';
      const safeImage = imageUrl ? validateAvatarInput(imageUrl) : '';
      const cleanStatus = ['PUBLISHED', 'DRAFT', 'ARCHIVED'].includes(status) ? status : 'PUBLISHED';

      if (cleanTitle.length < 3 || cleanContent.length < 10) {
        res.status(400).json({ error: 'Judul (min 3 karakter) dan isi pengumuman (min 10 karakter) wajib diisi.' });
        return;
      }

      const now = getJakartaNow().iso;
      const id = generateId('ann');
      db.prepare(`
        INSERT INTO announcements (id, title, content, image_url, status, author_id, published_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, cleanTitle, cleanContent, safeImage, cleanStatus, auth.id, cleanStatus === 'PUBLISHED' ? now : null, now, now);

      if (cleanStatus === 'PUBLISHED') {
        notifyAllApprovedMembers('ANNOUNCEMENT_NEW', 'Pengumuman Baru WALUH FAMILY', cleanTitle, 'announcements');
      }

      writeAuditLog({
        actorId: auth.id,
        actorName: auth.fullName,
        actorRole: auth.roleCode,
        action: 'ANNOUNCEMENT_CREATED',
        targetType: 'announcement',
        targetId: id,
        details: { title: cleanTitle, status: cleanStatus },
        ipAddress: getClientIp(req),
      });

      res.status(201).json({ message: 'Pengumuman berhasil disimpan.', id });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal membuat pengumuman.' });
    }
  });

  app.patch('/api/announcements/:id', requireAuth, requirePermission('announcements.manage'), (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id) as
      | { id: string; title: string; status: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Pengumuman tidak ditemukan.' });
      return;
    }

    const { title, content, status } = req.body ?? {};
    const now = getJakartaNow().iso;
    const nextStatus = ['PUBLISHED', 'DRAFT', 'ARCHIVED'].includes(status) ? status : existing.status;

    db.prepare(`
      UPDATE announcements
      SET title = COALESCE(?, title),
          content = COALESCE(?, content),
          status = ?,
          published_at = CASE WHEN ? = 'PUBLISHED' AND published_at IS NULL THEN ? ELSE published_at END,
          updated_at = ?
      WHERE id = ?
    `).run(
      typeof title === 'string' ? title.trim() : null,
      typeof content === 'string' ? content.trim() : null,
      nextStatus,
      nextStatus,
      now,
      now,
      existing.id
    );

    if (existing.status !== 'PUBLISHED' && nextStatus === 'PUBLISHED') {
      notifyAllApprovedMembers('ANNOUNCEMENT_NEW', 'Pengumuman Baru WALUH FAMILY', title || existing.title, 'announcements');
    }

    writeAuditLog({
      actorId: auth.id,
      actorName: auth.fullName,
      actorRole: auth.roleCode,
      action: 'ANNOUNCEMENT_UPDATED',
      targetType: 'announcement',
      targetId: existing.id,
      details: { status: nextStatus },
      ipAddress: getClientIp(req),
    });

    res.json({ message: 'Pengumuman berhasil diperbarui.' });
  });

  // ==========================================
  // 9. NOTIFICATIONS
  // ==========================================
  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const rows = db
      .prepare('SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 50')
      .all(auth.id);
    res.json({ notifications: rows });
  });

  app.post('/api/notifications/read', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const { id } = req.body ?? {};
    if (typeof id === 'string' && id) {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?').run(id, auth.id);
    } else {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_id = ?').run(auth.id);
    }
    res.json({ message: 'Notifikasi ditandai sudah dibaca.' });
  });

  // ==========================================
  // 10. ADMIN & CAPSU MEMBER/REGISTRATION MANAGEMENT
  // ==========================================
  app.get('/api/admin/registrations', requireAuth, requirePermission('registrations.review'), (_req, res) => {
    const rows = db
      .prepare(
        `SELECT r.*, p.avatar_url, rev.full_name as reviewed_by_name
         FROM registrations r
         JOIN profiles p ON p.id = r.profile_id
         LEFT JOIN profiles rev ON rev.id = r.reviewed_by
         ORDER BY CASE WHEN r.status = 'PENDING' THEN 0 ELSE 1 END, r.created_at DESC`
      )
      .all();
    res.json({ registrations: rows });
  });

  app.post(
    '/api/admin/registrations/:id/decision',
    requireAuth,
    requirePermission('registrations.review'),
    (req: AuthedRequest, res) => {
      const auth = req.auth!;
      const { decision, reviewNote } = req.body ?? {};
      if (!['APPROVE', 'REJECT'].includes(decision)) {
        res.status(400).json({ error: 'Keputusan harus APPROVE atau REJECT.' });
        return;
      }

      const reg = db.prepare('SELECT * FROM registrations WHERE id = ?').get(req.params.id) as
        | { id: string; profile_id: string; full_name: string; username: string; status: string }
        | undefined;
      if (!reg) {
        res.status(404).json({ error: 'Data pendaftaran tidak ditemukan.' });
        return;
      }
      if (reg.status !== 'PENDING') {
        res.status(400).json({ error: 'Pendaftaran ini sudah diproses sebelumnya.' });
        return;
      }

      const now = getJakartaNow().iso;
      const newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const note = typeof reviewNote === 'string' ? reviewNote.trim().slice(0, 300) : '';

      const tx = db.transaction(() => {
        db.prepare('UPDATE registrations SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = ? WHERE id = ?').run(
          newStatus,
          auth.id,
          note,
          now,
          reg.id
        );
        db.prepare(
          `UPDATE profiles
           SET status = ?,
               jabatan = CASE WHEN ? = 'APPROVED' THEN 'Anggota Resmi' ELSE jabatan END,
               joined_at = CASE WHEN ? = 'APPROVED' THEN ? ELSE joined_at END,
               updated_at = ?
           WHERE id = ?`
        ).run(newStatus, newStatus, newStatus, now, now, reg.profile_id);
      });
      tx();

      createNotification({
        recipientId: reg.profile_id,
        type: 'REGISTRATION_DECISION',
        title: decision === 'APPROVE' ? 'Selamat Datang di WALUH FAMILY' : 'Status Pendaftaran',
        message:
          decision === 'APPROVE'
            ? `Pendaftaran Anda disetujui oleh ${auth.fullName}. Kini Anda memiliki akses penuh sebagai anggota resmi.`
            : `Pendaftaran Anda ditolak oleh ${auth.fullName}.${note ? ` Catatan: ${note}` : ''}`,
        linkTab: 'overview',
      });

      writeAuditLog({
        actorId: auth.id,
        actorName: auth.fullName,
        actorRole: auth.roleCode,
        action: decision === 'APPROVE' ? 'REGISTRATION_APPROVED' : 'REGISTRATION_REJECTED',
        targetType: 'registration',
        targetId: reg.id,
        details: { memberName: reg.full_name, username: reg.username },
        reason: note,
        ipAddress: getClientIp(req),
      });

      res.json({
        message:
          decision === 'APPROVE'
            ? `Pendaftaran ${reg.full_name} berhasil disetujui.`
            : `Pendaftaran ${reg.full_name} telah ditolak.`,
      });
    }
  );

  app.patch('/api/admin/members/:id', requireAuth, requirePermission('members.manage'), (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const target = db
      .prepare('SELECT id, full_name, username, role_code, jabatan, status FROM profiles WHERE id = ? AND deleted_at IS NULL')
      .get(req.params.id) as
      | { id: string; full_name: string; username: string; role_code: string; jabatan: string; status: string }
      | undefined;

    if (!target) {
      res.status(404).json({ error: 'Anggota tidak ditemukan.' });
      return;
    }

    const { roleCode, jabatan, status, reason } = req.body ?? {};
    const now = getJakartaNow().iso;

    let nextRole = target.role_code;
    if (typeof roleCode === 'string' && roleCode !== target.role_code) {
      if (!auth.permissions.includes('roles.assign') && auth.roleCode !== 'CAPSU') {
        res.status(403).json({ error: 'Hanya CAPSU atau pemegang izin roles.assign yang dapat mengubah jabatan/role.' });
        return;
      }
      const validRole = db.prepare('SELECT code FROM roles WHERE code = ?').get(roleCode);
      if (!validRole) {
        res.status(400).json({ error: 'Role tidak valid.' });
        return;
      }
      if (target.role_code === 'CAPSU' && roleCode !== 'CAPSU') {
        const capsuCount = (
          db.prepare("SELECT COUNT(*) as cnt FROM profiles WHERE role_code = 'CAPSU' AND status = 'APPROVED'").get() as {
            cnt: number;
          }
        ).cnt;
        if (capsuCount <= 1) {
          res.status(400).json({ error: 'Tidak dapat menurunkan CAPSU tunggal. Lantik CAPSU baru terlebih dahulu.' });
          return;
        }
      }
      nextRole = roleCode;
    }

    let nextStatus = target.status;
    if (typeof status === 'string' && status !== target.status) {
      if (!['APPROVED', 'SUSPENDED', 'REJECTED'].includes(status)) {
        res.status(400).json({ error: 'Status anggota tidak valid.' });
        return;
      }
      if (target.id === auth.id && status !== 'APPROVED') {
        res.status(400).json({ error: 'Anda tidak dapat menangguhkan akun Anda sendiri.' });
        return;
      }
      if (target.role_code === 'CAPSU' && auth.roleCode !== 'CAPSU') {
        res.status(403).json({ error: 'Hanya CAPSU yang dapat mengubah status CAPSU.' });
        return;
      }
      nextStatus = status;
    }

    const nextJabatan = typeof jabatan === 'string' && jabatan.trim() ? jabatan.trim().slice(0, 60) : target.jabatan;

    const tx = db.transaction(() => {
      db.prepare('UPDATE profiles SET role_code = ?, jabatan = ?, status = ?, updated_at = ? WHERE id = ?').run(
        nextRole,
        nextJabatan,
        nextStatus,
        now,
        target.id
      );

      if (nextStatus === 'SUSPENDED' || nextStatus === 'REJECTED') {
        db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE profile_id = ? AND revoked_at IS NULL').run(
          now,
          target.id
        );
      }
    });
    tx();

    if (nextRole !== target.role_code) {
      createNotification({
        recipientId: target.id,
        type: 'ROLE_UPDATED',
        title: 'Pembaruan Jabatan Komunitas',
        message: `Jabatan Anda diperbarui menjadi ${nextJabatan} (Role: ${nextRole}) oleh ${auth.fullName}.`,
        linkTab: 'organization',
      });
    }

    writeAuditLog({
      actorId: auth.id,
      actorName: auth.fullName,
      actorRole: auth.roleCode,
      action: 'MEMBER_UPDATED_BY_OFFICER',
      targetType: 'profile',
      targetId: target.id,
      details: {
        memberName: target.full_name,
        previousRole: target.role_code,
        newRole: nextRole,
        previousStatus: target.status,
        newStatus: nextStatus,
        jabatan: nextJabatan,
      },
      reason: typeof reason === 'string' ? reason.trim() : '',
      ipAddress: getClientIp(req),
    });

    res.json({ message: `Data anggota ${target.full_name} berhasil diperbarui.` });
  });

  // ==========================================
  // 11. GOVERNANCE: ROLES, SETTINGS & AUDIT LOGS
  // ==========================================
  app.get('/api/governance/roles', requireAuth, requirePermission('roles.configure'), (_req, res) => {
    const roles = db.prepare('SELECT * FROM roles ORDER BY rank_order ASC').all() as Array<{
      code: string;
      name: string;
      rank_order: number;
      description: string;
    }>;
    const permissions = db.prepare('SELECT * FROM permissions ORDER BY code ASC').all();
    const mappings = db.prepare('SELECT role_code, permission_code FROM role_permissions').all() as Array<{
      role_code: string;
      permission_code: string;
    }>;

    res.json({
      roles: roles.map((r) => ({
        ...r,
        permissions: mappings.filter((m) => m.role_code === r.code).map((m) => m.permission_code),
      })),
      allPermissions: permissions,
    });
  });

  app.put('/api/governance/roles/:code/permissions', requireAuth, requirePermission('roles.configure'), (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const roleCode = req.params.code;
    const { permissions } = req.body ?? {};

    if (roleCode === 'CAPSU') {
      res.status(400).json({ error: 'Hak akses tertinggi CAPSU tidak dapat dikurangi.' });
      return;
    }
    const role = db.prepare('SELECT code FROM roles WHERE code = ?').get(roleCode);
    if (!role) {
      res.status(404).json({ error: 'Role tidak ditemukan.' });
      return;
    }
    if (!Array.isArray(permissions)) {
      res.status(400).json({ error: 'Daftar permission tidak valid.' });
      return;
    }

    const validPerms = new Set(
      (db.prepare('SELECT code FROM permissions').all() as Array<{ code: string }>).map((p) => p.code)
    );
    const filtered = permissions.filter((p): p is string => typeof p === 'string' && validPerms.has(p));

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM role_permissions WHERE role_code = ?').run(roleCode);
      const ins = db.prepare('INSERT INTO role_permissions (role_code, permission_code) VALUES (?, ?)');
      for (const perm of filtered) {
        ins.run(roleCode, perm);
      }
    });
    tx();

    writeAuditLog({
      actorId: auth.id,
      actorName: auth.fullName,
      actorRole: auth.roleCode,
      action: 'ROLE_PERMISSIONS_UPDATED',
      targetType: 'role',
      targetId: roleCode,
      details: { permissions: filtered },
      ipAddress: getClientIp(req),
    });

    res.json({ message: `Permission role ${roleCode} berhasil diperbarui.` });
  });

  app.put('/api/governance/settings', requireAuth, requirePermission('settings.manage'), (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const { philosophy, vision, mission, rules, contactEmail } = req.body ?? {};
    const now = getJakartaNow().iso;

    const upsert = db.prepare(`
      INSERT INTO community_settings (key, value, updated_by, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at
    `);

    const tx = db.transaction(() => {
      if (typeof philosophy === 'string' && philosophy.trim()) upsert.run('philosophy', philosophy.trim(), auth.id, now);
      if (typeof vision === 'string' && vision.trim()) upsert.run('vision', vision.trim(), auth.id, now);
      if (Array.isArray(mission)) upsert.run('mission', JSON.stringify(mission.filter((m) => typeof m === 'string' && m.trim())), auth.id, now);
      if (Array.isArray(rules)) upsert.run('rules', JSON.stringify(rules.filter((r) => typeof r === 'string' && r.trim())), auth.id, now);
      if (typeof contactEmail === 'string' && contactEmail.trim()) upsert.run('contact_email', contactEmail.trim(), auth.id, now);
    });
    tx();

    writeAuditLog({
      actorId: auth.id,
      actorName: auth.fullName,
      actorRole: auth.roleCode,
      action: 'COMMUNITY_SETTINGS_UPDATED',
      targetType: 'community_settings',
      targetId: 'global',
      ipAddress: getClientIp(req),
    });

    res.json({ message: 'Pengaturan resmi komunitas berhasil diperbarui.' });
  });

  app.get('/api/governance/audit-logs', requireAuth, requirePermission('audit.view'), (req, res) => {
    const actionFilter = typeof req.query.action === 'string' ? req.query.action.trim() : '';
    const limit = Math.min(200, Math.max(20, Number(req.query.limit) || 80));

    const logs = actionFilter
      ? db
          .prepare('SELECT * FROM audit_logs WHERE action LIKE ? ORDER BY created_at DESC LIMIT ?')
          .all(`%${actionFilter}%`, limit)
      : db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?').all(limit);

    res.json({ logs });
  });
}
