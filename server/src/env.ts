import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

/** A secret from NAME, or from the file named by NAME_FILE (so keys need not sit in .env). */
function secret(name: string): string {
  const direct = process.env[name];
  if (direct) return direct;
  const file = process.env[`${name}_FILE`];
  if (file) return fs.readFileSync(file, 'utf8').trim();
  throw new Error(`Missing env ${name} (or ${name}_FILE)`);
}

/**
 * SESSION_SECRET signs sessions, the agents' /mcp tokens and the owner sign-in key, so a guessable
 * one (the placeholder from .env.example, or anything short) would let anyone in.
 */
function sessionSecret(): string {
  const v = req('SESSION_SECRET');
  if (/^change-me/i.test(v) || v.length < 16) {
    throw new Error('SESSION_SECRET is the example placeholder or too short. Set it to a long random value, e.g. `openssl rand -hex 32`.');
  }
  return v;
}

/** True for http(s)://localhost, 127.x.x.x and [::1] URLs. */
export function isLoopbackUrl(u: string): boolean {
  try {
    const h = new URL(u).hostname.replace(/^\[|\]$/g, '');
    return h === 'localhost' || h.endsWith('.localhost') || h === '::1' || /^127\.\d+\.\d+\.\d+$/.test(h);
  } catch {
    return false;
  }
}

/** BOTHQ_<name>, or GROKBOT_<name> as set up before the project was renamed. */
export function compatEnv(name: string): string | undefined {
  return process.env[`BOTHQ_${name}`] ?? process.env[`GROKBOT_${name}`];
}

/** Default database file. One made before the rename (data/grokbot.db) keeps being used. */
function defaultDbPath(): string {
  const current = new URL('../../data/bothq.db', import.meta.url).pathname;
  const legacy = new URL('../../data/grokbot.db', import.meta.url).pathname;
  return !fs.existsSync(current) && fs.existsSync(legacy) ? legacy : current;
}

const hermesHome = process.env.HERMES_HOME_PRIMARY ?? path.join(os.homedir(), '.hermes');
const appUrl = process.env.APP_URL ?? 'http://localhost:5173';

export const env = {
  port: Number(process.env.PORT ?? 8787),
  /** Interface to listen on. Unset = every interface (what an Orgo public URL needs). */
  host: process.env.HOST || undefined,
  appUrl,
  /** Public URL of this server, used for OAuth callbacks. */
  serverUrl: process.env.SERVER_URL ?? `http://localhost:${process.env.PORT ?? 8787}`,
  /** The app is only reachable at a local address (development). Some conveniences are limited to this. */
  localOnly: isLoopbackUrl(appUrl),
  xaiKey: req('XAI_API_KEY'),
  xaiModel: process.env.XAI_MODEL ?? 'grok-4.7',
  composioKey: req('COMPOSIO_API_KEY'),
  orgoKey: secret('ORGO_API_KEY'),
  sessionSecret: sessionSecret(),
  /** Email-only sign-in for testing. Honoured only when APP_URL is a local address (see routes.ts). */
  devLogin: process.env.DEV_LOGIN === '1' && isLoopbackUrl(appUrl),
  dbPath: process.env.DB_PATH ?? defaultDbPath(),

  // ---- Hermes engine ----
  /** The `hermes` CLI used to start a gateway for each extra bot. */
  hermesBin: process.env.HERMES_BIN ?? 'hermes',
  /** The primary bot's Hermes home and API server (an agent that already runs; never restarted by us). */
  hermesHome,
  hermesUrl: (process.env.HERMES_URL ?? 'http://127.0.0.1:8642').replace(/\/+$/, ''),
  hermesKey: process.env.HERMES_KEY ?? '',
  /** Where each extra bot's own Hermes home lives. Must be outside ~/.hermes so it is a separate tenant. */
  enginesDir: process.env.ENGINES_DIR ?? new URL('../../data/engines', import.meta.url).pathname,
  enginePortBase: Number(process.env.ENGINE_PORT_BASE ?? 8650),
  /** URL the Hermes gateways use to reach this server's MCP endpoint. */
  mcpBaseUrl: (process.env.MCP_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 8787}`).replace(/\/+$/, ''),
  /** Extra MCP servers every managed bot gets, as a JSON object of Hermes `mcp_servers` entries (e.g. X's XMCP). */
  extraMcpServers: process.env.EXTRA_MCP_SERVERS ?? '',
  primaryBotName: process.env.PRIMARY_BOT_NAME ?? 'Doug',
  primaryBotLabel: process.env.PRIMARY_BOT_LABEL ?? 'Chief of Staff',

  // ---- the one shared computer ----
  /** The Orgo computer every bot works on (one screen each). Empty = legacy one-box-per-user mode is not supported. */
  orgoComputerId: process.env.ORGO_COMPUTER_ID ?? '',
  /** This server runs on that computer, so shell commands run locally instead of through Orgo's API. */
  localBox: process.env.HQ_LOCAL === '1',
  /**
   * DevTools URL of a Chrome that already runs on the default screen and belongs to the primary bot
   * (e.g. http://127.0.0.1:9333). When set, we never start or stop that screen's Chrome ourselves.
   */
  primaryCdpUrl: process.env.PRIMARY_CDP_URL ?? '',
  /** Bots that can each have a screen (Orgo allows four screens on one Linux computer). */
  maxBots: Number(process.env.MAX_BOTS ?? 4),
  /**
   * Comma-separated emails allowed to sign in. Empty = anyone, but only while APP_URL is a local
   * address; on a public URL an empty list lets no new account in (see routes.ts).
   */
  allowedEmails: (process.env.ALLOWED_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
};

if (process.env.DEV_LOGIN === '1' && !env.devLogin) {
  console.warn('[env] DEV_LOGIN=1 is ignored because APP_URL is not a local address. Use scripts/sign-in-link.sh instead.');
}
if (!env.localOnly && !env.allowedEmails.length) {
  console.warn('[env] ALLOWED_EMAILS is empty and APP_URL is public: only existing accounts (and scripts/sign-in-link.sh) can sign in.');
}
