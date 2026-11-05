import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/**
 * ChatGPT credentials on this computer. They are encrypted because a refresh token
 * spends someone's plan, with the key kept outside the project so that copying,
 * zipping or committing the project can't carry a working credential with it.
 */
export type ChatGPTAccount = {
  clientId: string;
  subject: string;
  email: string | null;
  /** The Repo user this plan pays for. Another person on this computer never spends it. */
  owner: string;
  idToken: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Milliseconds since the epoch. */
  expiresAt: number;
  scopes: string[];
  savedAt: string;
};

type State = { hostId: string; lastClientId: string | null; accounts: ChatGPTAccount[] };

const FILE = path.join(process.cwd(), ".data", "chatgpt.enc");
const KEY_FILE = path.join(homedir(), ".outfits", "chatgpt.key");

function writePrivate(file: string, data: Buffer | string) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${randomUUID()}.tmp`;
  writeFileSync(tmp, data, { mode: 0o600 });
  renameSync(tmp, file);
  try {
    chmodSync(file, 0o600);
  } catch {
    // Windows has no such mode: the file inherits the user profile's permissions.
  }
}

function key() {
  if (existsSync(KEY_FILE)) return readFileSync(KEY_FILE);
  const created = randomBytes(32);
  writePrivate(KEY_FILE, created);
  return created;
}

function fresh(): State {
  return { hostId: `urn:uuid:${randomUUID()}`, lastClientId: null, accounts: [] };
}

/** With LOCAL_PERSIST=0 nothing touches disk, so the end-to-end suite can never find, and spend, a real plan. */
const inMemory = () => process.env.LOCAL_PERSIST === "0";
const memory = globalThis as { __chatgptState?: State };

export function readState(): State {
  if (inMemory()) return (memory.__chatgptState ??= fresh());
  if (!existsSync(FILE)) return fresh();
  try {
    const raw = readFileSync(FILE);
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as State;
  } catch (e) {
    // The key was removed or the file damaged. Nothing here is recoverable, and the person can simply sign in again.
    console.warn("[chatgpt] saved credentials couldn't be read", (e as Error).message);
    return fresh();
  }
}

export function writeState(state: State) {
  if (inMemory()) {
    memory.__chatgptState = state;
    return;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
  writePrivate(FILE, Buffer.concat([iv, cipher.getAuthTag(), body]));
}

export function updateAccount(clientId: string, patch: Partial<ChatGPTAccount>) {
  const state = readState();
  const account = state.accounts.find((a) => a.clientId === clientId);
  if (!account) return null;
  Object.assign(account, patch, { savedAt: new Date().toISOString() });
  writeState(state);
  return account;
}
