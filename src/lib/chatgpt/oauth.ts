import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { readState, updateAccount, writeState, type ChatGPTAccount } from "./store";

/**
 * Sign in with ChatGPT, implemented from OpenAI's protocol docs:
 * https://developers.openai.com/siwc/token-sharing-open-source/sign-in
 *
 * No client secret or API key exists here: OpenAI registers a client for each account
 * during its first sign-in. Plan usage requires a redirect to 127.0.0.1, so this only
 * works while Outfits runs on the user's own computer. A remotely hosted deployment
 * needs OpenAI's approval first: https://openai.com/form/sign-in-with-chatgpt-interest/
 */
const ISSUER = "https://auth.openai.com";
const AUTHORIZE_URL = `${ISSUER}/api/accounts/authorize`;
const TOKEN_URL = `${ISSUER}/api/accounts/oauth/token`;
const RESOURCE = "https://api.openai.com/v1";
const SCOPES = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const PLAN_SCOPE = "chatgpt.tokens.use.direct";
const CALLBACK_PATH = "/auth/callback";
const AGENT_NAME = "Outfits";
/** Renew this early so a token can't expire in the middle of a long stylist reply. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Address details of this request, or null when OpenAI wouldn't accept its redirect. */
export function loopbackAddress(request: Request | Headers) {
  if (process.env.VERCEL) return null;
  const headers = request instanceof Headers ? request : request.headers;
  const host = headers.get("host") ?? "";
  const url = URL.canParse(`http://${host}`) ? new URL(`http://${host}`) : null;
  if (!url || !LOOPBACK.has(url.hostname)) return null;
  return { isCanonical: url.hostname === "127.0.0.1", origin: `http://127.0.0.1${url.port ? `:${url.port}` : ""}` };
}

export type Transaction = { state: string; nonce: string; verifier: string; clientId: string | null; redirectUri: string };

const random = () => randomBytes(32).toString("base64url");

/** Fresh state, nonce and PKCE values for one attempt, and the URL to send the browser to. */
export function beginSignIn(origin: string, opts: { newAccount?: boolean } = {}) {
  const state = readState();
  if (!state.lastClientId && !state.accounts.length) writeState(state); // keeps the host id stable from the first attempt
  const clientId = opts.newAccount ? null : state.lastClientId;
  const tx: Transaction = { state: random(), nonce: random(), verifier: random(), clientId, redirectUri: `${origin}${CALLBACK_PATH}` };
  const url = new URL(AUTHORIZE_URL);
  const params: Record<string, string> = {
    client_id: clientId ?? "dynamic_agent_client",
    ext_agent_host_id: state.hostId,
    response_type: "code",
    redirect_uri: tx.redirectUri,
    scope: SCOPES,
    resource: RESOURCE,
    state: tx.state,
    nonce: tx.nonce,
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(tx.verifier).digest("base64url"),
  };
  if (!clientId) params.agent_name_hint = AGENT_NAME;
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return { url: url.toString(), tx };
}

export class SignInError extends Error {
  constructor(public code: "cancelled" | "failed") {
    super(code);
  }
}

type TokenResponse = { access_token?: string; refresh_token?: string; id_token?: string; expires_in?: number; scope?: string; error?: string | { code?: string } };

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(body),
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  return { ok: res.ok, status: res.status, data };
}

async function verifyIdentity(idToken: string, clientId: string, nonce?: string) {
  const { payload } = await jwtVerify(idToken, jwks, { issuer: ISSUER, audience: clientId });
  if (nonce !== undefined && payload.nonce !== nonce) throw new Error("The sign-in response didn't match this attempt");
  if (!payload.sub) throw new Error("The sign-in response had no account");
  return { subject: payload.sub, email: typeof payload.email === "string" ? payload.email : null, emailVerified: payload.email_verified === true };
}

/** Validates the callback and exchanges its code. The caller decides whose account this becomes. */
export async function finishSignIn(params: URLSearchParams, tx: Transaction) {
  if (params.get("state") !== tx.state) throw new SignInError("failed");
  if (params.get("error")) throw new SignInError(params.get("error") === "access_denied" ? "cancelled" : "failed");
  const code = params.get("code");
  const returned = params.get("client_id");
  if (tx.clientId && returned && returned !== tx.clientId) throw new SignInError("failed");
  const clientId = tx.clientId ?? returned;
  if (!code || !clientId) throw new SignInError("failed");

  // Saved before the exchange, so a failure below can't leave an orphan registration.
  const state = readState();
  state.lastClientId = clientId;
  writeState(state);

  const { ok, status, data } = await tokenRequest({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    code_verifier: tx.verifier,
    redirect_uri: tx.redirectUri,
    resource: RESOURCE,
  });
  if (!ok || !data.id_token || !data.access_token) {
    console.error("[chatgpt] token exchange failed with status", status);
    throw new SignInError("failed");
  }
  const identity = await verifyIdentity(data.id_token, clientId, tx.nonce);
  return { clientId, tokens: data, ...identity };
}

/** Saves a verified sign-in for its owner. Returns whether this is their first with this account. */
export function saveAccount(owner: string, signIn: Awaited<ReturnType<typeof finishSignIn>>) {
  const state = readState();
  const existing = state.accounts.find((a) => a.clientId === signIn.clientId);
  const account: ChatGPTAccount = {
    clientId: signIn.clientId,
    subject: signIn.subject,
    email: signIn.email,
    owner,
    idToken: signIn.tokens.id_token ?? null,
    accessToken: signIn.tokens.access_token ?? null,
    refreshToken: signIn.tokens.refresh_token ?? null,
    expiresAt: Date.now() + (signIn.tokens.expires_in ?? 3600) * 1000,
    scopes: (signIn.tokens.scope ?? "").split(/\s+/).filter(Boolean),
    savedAt: new Date().toISOString(),
  };
  // Only one account pays for an owner at a time. Others keep their registration, without tokens.
  for (const other of state.accounts) {
    if (other.owner === owner && other.clientId !== account.clientId) Object.assign(other, { accessToken: null, refreshToken: null, idToken: null });
  }
  state.accounts = [...state.accounts.filter((a) => a.clientId !== account.clientId), account];
  state.lastClientId = account.clientId;
  writeState(state);
  return { firstTime: !existing };
}

export function accountFor(owner: string | null | undefined) {
  if (!owner) return null;
  return readState().accounts.find((a) => a.owner === owner && a.accessToken) ?? null;
}

export const hasPlanAccess = (a: ChatGPTAccount | null) => !!a?.scopes.includes(PLAN_SCOPE);

const TERMINAL_REFRESH = new Set(["invalid_grant", "invalid_refresh_token", "token_expired", "refresh_token_expired", "refresh_token_invalidated", "refresh_token_reused"]);

export class ReconnectNeeded extends Error {
  constructor() {
    super("Your ChatGPT connection has expired. Sign in again from your profile.");
  }
}

/** Refresh tokens rotate, so concurrent refreshes must share one request. Global because route bundles don't share modules. */
const inFlight: Map<string, Promise<string>> = ((globalThis as { __chatgptRefresh?: Map<string, Promise<string>> }).__chatgptRefresh ??= new Map());

async function refresh(account: ChatGPTAccount): Promise<string> {
  if (!account.refreshToken) throw new ReconnectNeeded();
  const { ok, status, data } = await tokenRequest({ grant_type: "refresh_token", client_id: account.clientId, refresh_token: account.refreshToken, resource: RESOURCE });
  if (!ok || !data.access_token) {
    const code = typeof data.error === "string" ? data.error : data.error?.code;
    if (code && TERMINAL_REFRESH.has(code)) {
      updateAccount(account.clientId, { accessToken: null, refreshToken: null });
      throw new ReconnectNeeded();
    }
    // Temporary trouble: the credentials stay, so the next request can recover.
    throw new Error(`We couldn't reach ChatGPT (${status}). Try again in a moment.`);
  }
  // Saved first: the old refresh token is already spent, so these must survive anything below.
  updateAccount(account.clientId, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? account.refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scopes: data.scope ? data.scope.split(/\s+/).filter(Boolean) : account.scopes,
    ...(data.id_token ? { idToken: data.id_token } : {}),
  });
  if (data.id_token) {
    const identity = await verifyIdentity(data.id_token, account.clientId).catch((e) => {
      console.warn("[chatgpt] couldn't check the refreshed identity", e); // these tokens came straight from OpenAI over TLS
      return null;
    });
    if (identity && identity.subject !== account.subject) {
      updateAccount(account.clientId, { accessToken: null, refreshToken: null, idToken: null });
      throw new ReconnectNeeded();
    }
  }
  return data.access_token;
}

/** A usable access token for this owner, renewed if needed. */
export async function accessTokenFor(owner: string) {
  const account = accountFor(owner);
  if (!account?.accessToken) throw new ReconnectNeeded();
  if (account.expiresAt - Date.now() > REFRESH_MARGIN_MS) return account.accessToken;
  const running = inFlight.get(account.clientId);
  if (running) return running;
  const started = refresh(account).finally(() => inFlight.delete(account.clientId));
  inFlight.set(account.clientId, started);
  return started;
}

/** Removes the tokens here and asks OpenAI to end the session. The registration stays for next time. */
export async function disconnect(owner: string) {
  const account = accountFor(owner);
  if (!account) return { revoked: true };
  updateAccount(account.clientId, { accessToken: null, refreshToken: null, idToken: null });
  if (!account.refreshToken) return { revoked: true };
  try {
    const discovery = (await (await fetch(`${ISSUER}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(15_000) })).json()) as { revocation_endpoint?: string };
    if (!discovery.revocation_endpoint || new URL(discovery.revocation_endpoint).origin !== ISSUER) return { revoked: false };
    const res = await fetch(discovery.revocation_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: account.refreshToken, token_type_hint: "refresh_token", client_id: account.clientId }),
      signal: AbortSignal.timeout(15_000),
    });
    return { revoked: res.ok };
  } catch {
    return { revoked: false };
  }
}
