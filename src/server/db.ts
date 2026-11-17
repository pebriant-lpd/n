import Database from 'better-sqlite3';
import path from 'path';
import { generateId, hashPassword } from './auth.ts';
import { getJakartaNow } from './time.ts';

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.resolve(process.cwd(), 'waluh_family.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rank_order INTEGER NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      code TEXT PRIMARY KEY,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_code TEXT NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
      permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
      PRIMARY KEY (role_code, permission_code)
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_code TEXT NOT NULL REFERENCES roles(code),
      jabatan TEXT NOT NULL DEFAULT 'Anggota',
      bio TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      additional_info TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'DELETION_REQUESTED')),
      privacy_show_joined INTEGER NOT NULL DEFAULT 1,
      privacy_show_donations INTEGER NOT NULL DEFAULT 1,
      joined_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL,
      email TEXT NOT NULL,
      additional_info TEXT NOT NULL DEFAULT '',
      rules_accepted INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
      reviewed_by TEXT REFERENCES profiles(id),
      review_note TEXT NOT NULL DEFAULT '',
      reviewed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      tx_code TEXT NOT NULL UNIQUE,
      member_id TEXT NOT NULL REFERENCES profiles(id),
      amount_coins INTEGER NOT NULL CHECK (amount_coins > 0),
      donation_date TEXT NOT NULL,
      week_key TEXT NOT NULL,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      month_key TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (status IN ('VERIFIED', 'REVERSED')),
      recorded_by TEXT NOT NULL REFERENCES profiles(id),
      idempotency_key TEXT UNIQUE,
      recorded_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_donations_member ON donations(member_id);
    CREATE INDEX IF NOT EXISTS idx_donations_week ON donations(week_key);
    CREATE INDEX IF NOT EXISTS idx_donations_month ON donations(month_key);
    CREATE INDEX IF NOT EXISTS idx_donations_date ON donations(donation_date);
    CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);

    CREATE TABLE IF NOT EXISTS donation_adjustments (
      id TEXT PRIMARY KEY,
      donation_id TEXT NOT NULL REFERENCES donations(id),
      action_type TEXT NOT NULL CHECK (action_type IN ('REVERSAL', 'CORRECTION')),
      previous_amount INTEGER NOT NULL,
      new_amount INTEGER NOT NULL,
      replacement_donation_id TEXT REFERENCES donations(id),
      reason TEXT NOT NULL,
      adjusted_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL,
      poster_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED')),
      rsvp_enabled INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_attendees (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      rsvp_status TEXT NOT NULL CHECK (rsvp_status IN ('GOING', 'MAYBE', 'DECLINED')),
      responded_at TEXT NOT NULL,
      UNIQUE (event_id, profile_id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED', 'DRAFT', 'ARCHIVED')),
      author_id TEXT NOT NULL REFERENCES profiles(id),
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link_tab TEXT NOT NULL DEFAULT 'overview',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT '',
      target_id TEXT NOT NULL DEFAULT '',
      details_json TEXT NOT NULL DEFAULT '{}',
      reason TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS community_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      user_agent TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      remember_me INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  seedRolesAndPermissions();
  seedCommunitySettings();
  seedInitialCapsu();
}

function seedRolesAndPermissions(): void {
  const rolesData = [
    { code: 'CAPSU', name: 'CAPSU / Kepala Suku', rank: 1, desc: 'Pemegang otoritas tertinggi komunitas WALUH FAMILY.' },
    { code: 'DEPUTI', name: 'Deputi / Wakil', rank: 2, desc: 'Wakil pimpinan yang mengawasi aktivitas, event, dan keuangan komunitas.' },
    { code: 'ADMIN', name: 'Admin', rank: 3, desc: 'Pengelola pendaftaran anggota, database member, pengumuman, dan event.' },
    { code: 'BENDAHARA', name: 'Bendahara', rank: 4, desc: 'Pengelola pencatatan donasi koin, koreksi berizin, dan laporan keuangan.' },
    { code: 'MEMBER', name: 'Member', rank: 5, desc: 'Anggota resmi keluarga WALUH FAMILY.' },
  ];

  const insertRole = db.prepare(`
    INSERT INTO roles (code, name, rank_order, description)
    VALUES (@code, @name, @rank, @desc)
    ON CONFLICT(code) DO UPDATE SET name = excluded.name, rank_order = excluded.rank_order, description = excluded.description
  `);

  const permsData = [
    { code: 'registrations.review', desc: 'Menyetujui atau menolak pendaftaran anggota baru' },
    { code: 'members.manage', desc: 'Mengelola data anggota, status aktif, dan penangguhan' },
    { code: 'roles.assign', desc: 'Mengangkat atau memberhentikan jabatan pengurus' },
    { code: 'roles.configure', desc: 'Mengatur hak akses dan izin setiap role' },
    { code: 'donations.create', desc: 'Menginput transaksi donasi koin anggota' },
    { code: 'donations.adjust', desc: 'Melakukan pembatalan atau koreksi transaksi donasi beralasan' },
    { code: 'donations.view_all', desc: 'Melihat ledger lengkap dan laporan keuangan' },
    { code: 'donations.export', desc: 'Mengekspor laporan donasi ke format CSV' },
    { code: 'events.manage', desc: 'Membuat, mengubah, dan mengelola event komunitas' },
    { code: 'announcements.manage', desc: 'Membuat, menerbitkan, dan mengarsipkan pengumuman' },
    { code: 'audit.view', desc: 'Melihat catatan audit log aktivitas platform' },
    { code: 'settings.manage', desc: 'Mengubah informasi resmi, visi misi, dan aturan komunitas' },
  ];

  const insertPerm = db.prepare(`
    INSERT INTO permissions (code, description)
    VALUES (@code, @desc)
    ON CONFLICT(code) DO UPDATE SET description = excluded.description
  `);

  const defaultMap: Record<string, string[]> = {
    CAPSU: permsData.map((p) => p.code),
    DEPUTI: [
      'members.manage',
      'donations.view_all',
      'donations.export',
      'events.manage',
      'announcements.manage',
      'audit.view',
    ],
    ADMIN: [
      'registrations.review',
      'members.manage',
      'events.manage',
      'announcements.manage',
    ],
    BENDAHARA: [
      'donations.create',
      'donations.adjust',
      'donations.view_all',
      'donations.export',
    ],
    MEMBER: [],
  };

  const countRolePerms = db.prepare('SELECT COUNT(*) as cnt FROM role_permissions').get() as { cnt: number };

  const tx = db.transaction(() => {
    for (const r of rolesData) insertRole.run(r);
    for (const p of permsData) insertPerm.run(p);

    if (countRolePerms.cnt === 0) {
      const insertRP = db.prepare('INSERT OR IGNORE INTO role_permissions (role_code, permission_code) VALUES (?, ?)');
      for (const [roleCode, perms] of Object.entries(defaultMap)) {
        for (const permCode of perms) {
          insertRP.run(roleCode, permCode);
        }
      }
    }
  });
  tx();
}

function seedCommunitySettings(): void {
  const now = getJakartaNow().iso;
  const defaults: Record<string, string> = {
    platform_name: 'WALUH FAMILY',
    full_name: 'WELLBORN FAMILY',
    tagline: 'ONE FAMILY. ONE LEGACY.',
    secondary_tagline: 'United by Loyalty, Strengthened by Brotherhood.',
    philosophy:
      'WALUH Family adalah rumah bersama bagi setiap anggota. Tempat membangun persahabatan, menjaga kepercayaan, memperkuat solidaritas, dan tumbuh bersama sebagai satu keluarga.',
    vision:
      'Membangun keluarga komunitas yang solid, harmonis, terpercaya, dan memiliki rasa persaudaraan yang kuat.',
    mission: JSON.stringify([
      'Menjaga persatuan dan solidaritas antaranggota.',
      'Membangun lingkungan yang nyaman dan saling menghargai.',
      'Mengembangkan komunikasi dan kerja sama.',
      'Menjaga transparansi serta tanggung jawab organisasi.',
      'Menciptakan kegiatan yang mempererat hubungan anggota.',
    ]),
    rules: JSON.stringify([
      'Menjunjung tinggi loyalitas, kejujuran, dan rasa hormat kepada seluruh anggota keluarga WALUH FAMILY.',
      'Dilarang keras menyebarkan data pribadi anggota lain (email, kredensial, atau informasi sensitif) ke pihak luar.',
      'Seluruh kontribusi donasi koin dicatat secara resmi melalui Bendahara dan terbuka untuk transparansi seluruh anggota aktif.',
      'Menjaga etika komunikasi yang sehat, bebas provokasi, bebas SARA, dan saling mendukung dalam setiap kegiatan komunitas.',
      'Mematuhi keputusan kepemimpinan CAPSU, Deputi, dan pengurus resmi demi keharmonisan dan ketertiban keluarga.',
    ]),
    contact_email: 'council@waluhfamily.org',
    retention_policy:
      'Penghapusan akun anggota mematuhi kebijakan retensi audit keuangan: catatan donasi historis tetap dipertahankan untuk menjaga integritas laporan transparansi komunitas.',
  };

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO community_settings (key, value, updated_at)
    VALUES (?, ?, ?)
  `);
  for (const [key, value] of Object.entries(defaults)) {
    stmt.run(key, value, now);
  }
}

function seedInitialCapsu(): void {
  const existing = db.prepare("SELECT COUNT(*) as cnt FROM profiles WHERE role_code = 'CAPSU'").get() as { cnt: number };
  if (existing.cnt > 0) return;

  const now = getJakartaNow().iso;
  const capsuId = generateId('usr');
  const email = process.env.BOOTSTRAP_CAPSU_EMAIL || 'capsu@waluhfamily.org';
  const rawPassword = process.env.BOOTSTRAP_CAPSU_PASSWORD || 'WaluhCapsu#2026';
  const passwordHash = hashPassword(rawPassword);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO profiles (
        id, username, email, password_hash, full_name, role_code, jabatan, bio,
        status, joined_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'CAPSU', ?, ?, 'APPROVED', ?, ?, ?)
    `).run(
      capsuId,
      'capsu_waluh',
      email,
      passwordHash,
      'Kepala Suku WALUH',
      'CAPSU / Kepala Suku',
      'Pemegang mandat tertinggi dan penjaga kehormatan keluarga WELLBORN FAMILY.',
      now,
      now,
      now
    );

    db.prepare(`
      INSERT INTO announcements (id, title, content, status, author_id, published_at, created_at, updated_at)
      VALUES (?, ?, ?, 'PUBLISHED', ?, ?, ?, ?)
    `).run(
      generateId('ann'),
      'Piagam Resmi Platform Komunitas WALUH FAMILY',
      'Selamat datang di rumah resmi WELLBORN FAMILY. Platform ini dibangun sebagai pusat koordinasi anggota, penjadwalan kegiatan, serta transparansi penuh kontribusi donasi mingguan (Senin–Minggu WIB). Junjung tinggi loyalitas, kepercayaan, dan persaudaraan.',
      capsuId,
      now,
      now,
      now
    );

    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, target_type, target_id, details_json, reason, created_at)
      VALUES (?, ?, 'Kepala Suku WALUH', 'CAPSU', 'SYSTEM_BOOTSTRAP', 'profile', ?, ?, 'Inisialisasi akun CAPSU perdana', ?)
    `).run(generateId('aud'), capsuId, capsuId, JSON.stringify({ email }), now);
  });

  tx();
}

export function getPermissionsForRole(roleCode: string): string[] {
  const rows = db
    .prepare('SELECT permission_code FROM role_permissions WHERE role_code = ?')
    .all(roleCode) as Array<{ permission_code: string }>;
  return rows.map((r) => r.permission_code);
}

export function writeAuditLog(params: {
  actorId?: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
}): void {
  const now = getJakartaNow().iso;
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, target_type, target_id, details_json, reason, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    generateId('aud'),
    params.actorId ?? null,
    params.actorName,
    params.actorRole,
    params.action,
    params.targetType ?? '',
    params.targetId ?? '',
    JSON.stringify(params.details ?? {}),
    params.reason ?? '',
    params.ipAddress ?? '',
    now
  );
}

export function createNotification(params: {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  linkTab?: string;
}): void {
  const now = getJakartaNow().iso;
  db.prepare(`
    INSERT INTO notifications (id, recipient_id, type, title, message, link_tab, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    generateId('ntf'),
    params.recipientId,
    params.type,
    params.title,
    params.message,
    params.linkTab ?? 'overview',
    now
  );
}

export function notifyRoles(roles: string[], type: string, title: string, message: string, linkTab = 'overview'): void {
  if (roles.length === 0) return;
  const placeholders = roles.map(() => '?').join(', ');
  const recipients = db
    .prepare(`SELECT id FROM profiles WHERE role_code IN (${placeholders}) AND status = 'APPROVED' AND deleted_at IS NULL`)
    .all(...roles) as Array<{ id: string }>;

  for (const r of recipients) {
    createNotification({ recipientId: r.id, type, title, message, linkTab });
  }
}

export function notifyAllApprovedMembers(type: string, title: string, message: string, linkTab = 'overview'): void {
  const recipients = db
    .prepare("SELECT id FROM profiles WHERE status = 'APPROVED' AND deleted_at IS NULL")
    .all() as Array<{ id: string }>;

  for (const r of recipients) {
    createNotification({ recipientId: r.id, type, title, message, linkTab });
  }
}
