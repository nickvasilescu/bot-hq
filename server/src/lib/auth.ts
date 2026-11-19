import type { Context, MiddlewareHandler } from 'hono';
import crypto from 'node:crypto';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { env } from '../env.js';
import { db, now } from '../db.js';
import { token } from './ids.js';
import type { User } from '../types.js';

const COOKIE = 'grokbot_session';
const TTL_MS = 30 * 24 * 3600 * 1000;

export type AuthVars = { Variables: { user: User } };

export function createSession(c: Context, userId: string) {
  const t = token();
  db.prepare('INSERT INTO auth_sessions(token,user_id,created_at,expires_at) VALUES (?,?,?,?)').run(t, userId, now(), now() + TTL_MS);
  setCookie(c, COOKIE, t, { httpOnly: true, sameSite: 'Lax', secure: env.appUrl.startsWith('https:'), path: '/', maxAge: TTL_MS / 1000 });
}

export function destroySession(c: Context) {
  const t = getCookie(c, COOKIE);
  if (t) db.prepare('DELETE FROM auth_sessions WHERE token=?').run(t);
  deleteCookie(c, COOKIE, { path: '/' });
}

export function userFromToken(t: string | undefined): User | null {
  if (!t) return null;
  const r = db
    .prepare('SELECT u.* FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?')
    .get(t, now()) as any;
  return r ? { id: r.id, email: r.email, name: r.name, avatarUrl: r.avatar_url } : null;
}

export function userFromCookieHeader(cookieHeader: string | undefined): User | null {
  const m = cookieHeader?.split(/;\s*/).find((p) => p.startsWith(`${COOKIE}=`));
  return userFromToken(m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : undefined);
}

export const requireUser: MiddlewareHandler<AuthVars> = async (c, next) => {
  const u = userFromToken(getCookie(c, COOKIE));
  if (!u) return c.json({ error: 'unauthenticated' }, 401);
  c.set('user', u);
  await next();
};

const originOf = (u: string) => { try { return new URL(u).origin; } catch { return null; } };
/** Origins the web app is served from: APP_URL, and SERVER_URL when the server serves the built app itself. */
const appOrigins = new Set([originOf(env.appUrl), originOf(env.serverUrl)].filter((o): o is string => !!o));

/**
 * Whether a request may act with the user's cookie. Browsers say where a request comes from
 * (Sec-Fetch-Site, Origin); anything from another site is refused, so a page elsewhere (including
 * another app under the same parent domain) cannot post to the API or open the screen socket as
 * the signed-in user. Requests without those headers come from scripts, not browsers, and carry no
 * ambient cookie.
 */
export function isSameOriginRequest(origin: string | undefined, fetchSite: string | undefined): boolean {
  if (fetchSite) return fetchSite === 'same-origin' || fetchSite === 'none';
  if (origin) return appOrigins.has(origin);
  return true;
}

/** Refuses cross-site requests that could change something (anything but GET/HEAD/OPTIONS). */
export const sameOriginWrites: MiddlewareHandler = async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && !isSameOriginRequest(c.req.header('origin'), c.req.header('sec-fetch-site'))) {
    return c.json({ error: 'cross-site request refused' }, 403);
  }
  await next();
};

/** A socket peer on this machine (127.0.0.0/8, ::1, or an IPv4-mapped loopback). */
export function isLoopbackAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  const a = addr.replace(/^::ffff:/i, '');
  return a === '::1' || /^127\.\d+\.\d+\.\d+$/.test(a);
}

/**
 * Key for signing in from the machine the server runs on (POST /api/auth/owner). It is derived from
 * SESSION_SECRET, so only someone who can read the server's .env can make it:
 *   printf 'owner-login' | openssl dgst -sha256 -hmac "$SESSION_SECRET" -r | cut -d' ' -f1
 */
export function isOwnerKey(given: string): boolean {
  const want = crypto.createHmac('sha256', env.sessionSecret).update('owner-login').digest();
  const got = Buffer.from(given, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
