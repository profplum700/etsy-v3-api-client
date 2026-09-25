import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const OWNER_FILE = "owner.json";
const DEFAULT_RETRIES = 40;
const DEFAULT_RETRY_DELAY_MS = 75;

interface LockOwner {
  version: 1;
  pid: number;
  token: string;
}

export class CredentialLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialLockError";
  }
}

export interface CredentialLockOptions {
  retries?: number;
  retryDelayMs?: number;
}

function isLockContention(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = String((error as { code?: unknown }).code);
  return code === "EEXIST" || code === "ENOTEMPTY" || code === "EPERM";
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function lockFailureMessage(lockPath: string): Promise<string> {
  try {
    const owner = JSON.parse(await readFile(joinOwnerPath(lockPath), "utf8")) as Partial<LockOwner>;
    if (owner.version === 1 && Number.isInteger(owner.pid) && (owner.pid ?? 0) > 0) {
      return "The Etsy credential store is locked by process " + owner.pid + " at " + lockPath + ". If that process is no longer running, remove the lock directory and retry. The lock was left in place; no unlocked credential change was attempted.";
    }
  } catch {
    // Keep an unreadable lock in place rather than guessing that it is stale.
  }
  return "The Etsy credential store has a lock with no readable owner record at " + lockPath + ". Remove it only after confirming no Etsy MCP or setup process is using it. No unlocked credential change was attempted.";
}

function joinOwnerPath(lockPath: string): string {
  return join(lockPath, OWNER_FILE);
}

/**
 * Claims one local credential-store transaction using an atomic directory rename.
 * The lock is never expired based on time: a suspended owner cannot be displaced.
 */
export async function acquireCredentialLock(
  lockPath: string,
  options: CredentialLockOptions = {},
): Promise<() => Promise<void>> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  if (!Number.isInteger(retries) || retries < 0 || !Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
    throw new CredentialLockError("The Etsy credential lock settings are invalid.");
  }

  try {
    await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });
  } catch {
    throw new CredentialLockError("The local Etsy credential lock directory could not be prepared. Check that your user config directory is writable; no credential change was made.");
  }

  const token = randomUUID();
  let candidatePath: string;
  try {
    candidatePath = await mkdtemp(lockPath + ".candidate-");
  } catch {
    throw new CredentialLockError("A private Etsy credential lock could not be created in the user config directory. No credential change was made.");
  }
  try {
    await writeFile(joinOwnerPath(candidatePath), JSON.stringify({ version: 1, pid: process.pid, token } satisfies LockOwner), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch {
    await rm(candidatePath, { recursive: true, force: true }).catch(() => undefined);
    throw new CredentialLockError("A private Etsy credential lock could not be created in the user config directory. No credential change was made.");
  }

  let acquired = false;
  try {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        await rename(candidatePath, lockPath);
        acquired = true;
        return async (): Promise<void> => {
          const retiredPath = lockPath + ".released-" + randomUUID();
          let owner: LockOwner;
          try {
            owner = JSON.parse(await readFile(joinOwnerPath(lockPath), "utf8")) as LockOwner;
          } catch {
            throw new CredentialLockError("The Etsy credential lock owner record could not be verified. The lock was not removed; check local credential-store status before retrying.");
          }
          if (owner.version !== 1 || owner.pid !== process.pid || owner.token !== token) {
            throw new CredentialLockError("The Etsy credential lock is no longer owned by this process. The lock was not removed; check local credential-store status before retrying.");
          }
          try {
            // Retire the exact canonical directory atomically before deleting it.
            // Once the rename succeeds, a new owner may claim lockPath while this
            // process removes only its unique retired path.
            await rename(lockPath, retiredPath);
          } catch {
            throw new CredentialLockError("The Etsy credential lock could not be retired cleanly. Check local credential-store status before retrying.");
          }
          try {
            const retiredOwner = JSON.parse(await readFile(joinOwnerPath(retiredPath), "utf8")) as LockOwner;
            if (retiredOwner.version !== 1 || retiredOwner.pid !== process.pid || retiredOwner.token !== token) {
              try {
                await rename(retiredPath, lockPath);
              } catch {
                throw new CredentialLockError("The Etsy credential lock changed during release and could not be restored safely. Preserve " + retiredPath + " and inspect local credential-store status.");
              }
              throw new CredentialLockError("The Etsy credential lock changed during release. Its directory was restored and no credential lock was removed.");
            }
            await rm(retiredPath, { recursive: true });
          } catch (error) {
            if (error instanceof CredentialLockError) throw error;
            throw new CredentialLockError("The retired Etsy credential lock could not be verified or removed. Check local credential-store status before retrying.");
          }
        };
      } catch (error) {
        if (!isLockContention(error)) {
          throw new CredentialLockError("The local Etsy credential lock could not be claimed safely. No credential change was made.");
        }
        if (attempt < retries) await delay(retryDelayMs);
      }
    }
    throw new CredentialLockError(await lockFailureMessage(lockPath));
  } finally {
    if (!acquired) await rm(candidatePath, { recursive: true, force: true }).catch(() => undefined);
  }
}
