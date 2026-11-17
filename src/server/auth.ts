import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const FALLBACK_DEV_SECRET = crypto.createHash('sha256').update('waluh-family-wellborn-local-secret-2026').digest('hex');

export function getJwtSecret(): string {
  return process.env.JWT_SECRET && process.env.JWT_SECRET !== 'replace-with-secure-64-char-random-secret'
    ? process.env.JWT_SECRET
    : FALLBACK_DEV_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export interface SessionJwtPayload {
  sub: string;
  sid: string;
}

export function signSessionToken(payload: SessionJwtPayload, rememberMe: boolean): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: rememberMe ? '30d' : '24h',
  });
}

export function verifySessionToken(token: string): SessionJwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as SessionJwtPayload;
    if (!decoded || !decoded.sub || !decoded.sid) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function generateId(prefix = ''): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function generateTxCode(dateStr: string): string {
  const compact = dateStr.replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `WLF-${compact}-${rand}`;
}
