import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { Entry, type EntryOptions } from "@napi-rs/keyring";
import { z } from "zod";
import { REQUIRED_SCOPES } from "./constants.js";
import { acquireCredentialLock, CredentialLockError } from "./credential-lock.js";

const SERVICE_NAME = "com.profplum700.etsy-mcp-server";
const ACCOUNT_NAME = "default";
const PROFILE_ACCOUNT_PREFIX = "shop-";

const scopeSet = new Set<string>(REQUIRED_SCOPES);

export const EtsyCredentialsSchema = z.object({
  version: z.literal(1),
  keystring: z.string().min(1),
  sharedSecret: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.string().datetime(),
  scope: z.string().min(1),
  shopId: z.string().regex(/^\d+$/),
  shopName: z.string().min(1),
}).strict();

const ProfileIndexSchema = z.object({
  version: z.literal(2),
  activeShopId: z.string().regex(/^\d+$/),
  profiles: z.array(z.object({
    shopId: z.string().regex(/^\d+$/),
    shopName: z.string().min(1),
  }).strict()).min(1),
}).strict();

export type EtsyCredentials = z.infer<typeof EtsyCredentialsSchema>;
type ProfileIndex = z.infer<typeof ProfileIndexSchema>;

export interface EtsyProfileSummary {
  shopId: string;
  shopName: string;
  active: boolean;
}

export interface SaveCredentialOptions {
  /** Keep the selected profile unchanged when persisting refreshed tokens. */
  activate?: boolean;
}

interface StoredDatabase {
  index: ProfileIndex | null;
  credentials: EtsyCredentials[];
}

export interface SecretEntry {
  getPassword(): string | null;
  setPassword(password: string): void;
  deletePassword(): boolean;
}

export type EntryFactory = (service: string, account: string) => SecretEntry;

export class CredentialStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialStoreError";
  }
}

function createPlatformEntry(service: string, account: string): SecretEntry {
  const options: EntryOptions | undefined = process.platform === "linux"
    ? { linux: { store: "secret-service" } }
    : undefined;

  return options
    ? new Entry(service, account, options)
    : new Entry(service, account);
}

function unavailableMessage(): string {
  if (process.platform === "linux") {
    return "Linux Secret Service is unavailable. Start and unlock a Secret Service keyring (such as GNOME Keyring or KeePassXC), then run setup again. No credentials were saved.";
  }
  return "The operating system credential store is unavailable. Unlock or enable it, then run setup again. No credentials were saved.";
}

function parseCredentials(value: unknown): EtsyCredentials {
  const parsed = EtsyCredentialsSchema.safeParse(value);
  if (!parsed.success) {
    throw new CredentialStoreError("The saved Etsy connection is invalid. Run `etsy-mcp-server setup` to reconnect.");
  }

  const grantedScopes = parsed.data.scope.split(/\s+/).filter(Boolean);
  if (grantedScopes.length !== scopeSet.size || grantedScopes.some((scope) => !scopeSet.has(scope))) {
    throw new CredentialStoreError("The saved Etsy connection does not have exactly the required read-only scopes. Run setup and approve only shops_r and listings_r.");
  }

  return parsed.data;
}

function parseProfileIndex(value: unknown): ProfileIndex {
  const parsed = ProfileIndexSchema.safeParse(value);
  if (!parsed.success) {
    throw new CredentialStoreError("The saved Etsy shop profiles are invalid. Use `etsy-mcp-server setup` to reconnect.");
  }

  const ids = parsed.data.profiles.map((profile) => profile.shopId);
  if (new Set(ids).size !== ids.length || !ids.includes(parsed.data.activeShopId)) {
    throw new CredentialStoreError("The saved Etsy shop profiles are inconsistent. Use `etsy-mcp-server setup` to reconnect.");
  }
  return parsed.data;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new CredentialStoreError("The saved Etsy connection is unreadable. Run `etsy-mcp-server setup` to reconnect.");
  }
}

function profileAccount(shopId: string): string {
  return PROFILE_ACCOUNT_PREFIX + shopId;
}

function lockFilePath(): string {
  let configDirectory: string;
  if (process.platform === "win32") {
    configDirectory = process.env.LOCALAPPDATA || process.env.APPDATA || join(homedir(), "AppData", "Local");
  } else if (process.platform === "darwin") {
    configDirectory = join(homedir(), "Library", "Application Support");
  } else {
    const xdgConfigHome = process.env.XDG_CONFIG_HOME;
    configDirectory = xdgConfigHome && isAbsolute(xdgConfigHome) ? xdgConfigHome : join(homedir(), ".config");
  }
  return join(configDirectory, "profplum700", "etsy-mcp-server", "credential-store.lock");
}

function isSameCredential(left: EtsyCredentials, right: EtsyCredentials): boolean {
  return left.keystring === right.keystring
    && left.sharedSecret === right.sharedSecret
    && left.accessToken === right.accessToken
    && left.refreshToken === right.refreshToken
    && left.expiresAt === right.expiresAt
    && left.scope === right.scope
    && left.shopId === right.shopId
    && left.shopName === right.shopName;
}

function profileSummary(credentials: EtsyCredentials, activeShopId: string): EtsyProfileSummary {
  return {
    shopId: credentials.shopId,
    shopName: credentials.shopName,
    active: credentials.shopId === activeShopId,
  };
}

function resolveProfile(profiles: EtsyCredentials[], selector: string): EtsyCredentials {
  const normalized = selector.trim();
  if (!normalized) throw new CredentialStoreError("Provide an Etsy shop name or ID.");

  const byId = profiles.filter((profile) => profile.shopId === normalized);
  const matches = byId.length > 0
    ? byId
    : profiles.filter((profile) => profile.shopName.toLocaleLowerCase() === normalized.toLocaleLowerCase());

  if (matches.length === 0) {
    throw new CredentialStoreError("No saved Etsy shop matches that name or ID. Run `etsy-mcp-server status` to see connected shops.");
  }
  if (matches.length > 1) {
    throw new CredentialStoreError("More than one saved Etsy shop has that name. Use its numeric Etsy shop ID instead.");
  }
  const selected = matches[0];
  if (!selected) throw new CredentialStoreError("The Etsy shop profile could not be selected.");
  return selected;
}

export class CredentialStore {
  constructor(
    private readonly entryFactory: EntryFactory = createPlatformEntry,
    private readonly transactionLockPath = lockFilePath(),
  ) {}

  private async withTransaction<T>(operation: () => T): Promise<T> {
    let release: () => Promise<void>;
    try {
      release = await acquireCredentialLock(this.transactionLockPath);
    } catch (error) {
      if (error instanceof CredentialLockError) throw new CredentialStoreError(error.message);
      throw new CredentialStoreError("The local Etsy credential lock could not be acquired safely. No credential change was made.");
    }

    let result: T | undefined;
    let operationFailed = false;
    let operationError: unknown;
    try {
      result = operation();
    } catch (error) {
      operationFailed = true;
      operationError = error;
    }
    try {
      await release();
    } catch (error) {
      if (error instanceof CredentialLockError) throw new CredentialStoreError(error.message);
      throw new CredentialStoreError("The local Etsy credential lock could not be released cleanly. Check the local connection status before retrying.");
    }
    if (operationFailed) throw operationError;
    return result as T;
  }

  probe(): void {
    const account = "probe-" + randomUUID();
    const value = randomUUID();
    let entry: SecretEntry | undefined;
    let writeSucceeded = false;
    let failed = false;

    try {
      entry = this.entryFactory(SERVICE_NAME, account);
      entry.setPassword(value);
      writeSucceeded = true;
      if (entry.getPassword() !== value) failed = true;
    } catch {
      failed = true;
    } finally {
      if (writeSucceeded && entry) {
        try {
          if (!entry.deletePassword()) failed = true;
        } catch {
          failed = true;
        }
      }
    }

    if (failed) throw new CredentialStoreError(unavailableMessage());
  }

  private readRaw(account: string): string | null {
    try {
      return this.entryFactory(SERVICE_NAME, account).getPassword();
    } catch {
      throw new CredentialStoreError(unavailableMessage());
    }
  }

  private writeRaw(account: string, value: string): void {
    try {
      this.entryFactory(SERVICE_NAME, account).setPassword(value);
    } catch {
      throw new CredentialStoreError(unavailableMessage());
    }
  }

  private deleteRaw(account: string): boolean {
    try {
      return this.entryFactory(SERVICE_NAME, account).deletePassword();
    } catch {
      throw new CredentialStoreError(unavailableMessage());
    }
  }

  private readProfile(shopId: string): EtsyCredentials {
    const value = this.readRaw(profileAccount(shopId));
    if (value === null) {
      throw new CredentialStoreError("A saved Etsy shop profile is missing from the operating system credential store. Run setup to reconnect that shop.");
    }
    const credentials = parseCredentials(parseJson(value));
    if (credentials.shopId !== shopId) {
      throw new CredentialStoreError("A saved Etsy shop profile does not match its credential-store entry. Run setup to reconnect.");
    }
    return credentials;
  }

  private readDatabase(): StoredDatabase {
    const value = this.readRaw(ACCOUNT_NAME);
    if (value === null) return { index: null, credentials: [] };

    const decoded = parseJson(value);
    if (typeof decoded === "object" && decoded !== null && "version" in decoded && decoded.version === 2) {
      const index = parseProfileIndex(decoded);
      return {
        index,
        credentials: index.profiles.map((profile) => this.readProfile(profile.shopId)),
      };
    }

    // Version 1 is the original one-shop record stored under "default".
    return { index: null, credentials: [parseCredentials(decoded)] };
  }

  private writeIndex(profiles: EtsyCredentials[], activeShopId: string): void {
    const index: ProfileIndex = {
      version: 2,
      activeShopId,
      profiles: profiles.map(({ shopId, shopName }) => ({ shopId, shopName })),
    };
    this.writeRaw(ACCOUNT_NAME, JSON.stringify(index));
  }

  private readUnlocked(shopId?: string): EtsyCredentials | null {
    const database = this.readDatabase();
    if (database.credentials.length === 0) return null;
    if (!database.index) {
      const legacy = database.credentials[0];
      if (!legacy) return null;
      return shopId === undefined || shopId === legacy.shopId ? legacy : null;
    }
    const selectedId = shopId ?? database.index.activeShopId;
    return database.credentials.find((profile) => profile.shopId === selectedId) ?? null;
  }

  async read(shopId?: string): Promise<EtsyCredentials | null> {
    return this.withTransaction(() => this.readUnlocked(shopId));
  }

  private listProfilesUnlocked(): EtsyProfileSummary[] {
    const database = this.readDatabase();
    if (database.credentials.length === 0) return [];
    const activeShopId = database.index?.activeShopId ?? database.credentials[0]?.shopId;
    if (!activeShopId) return [];
    return database.credentials.map((profile) => profileSummary(profile, activeShopId));
  }

  async listProfiles(): Promise<EtsyProfileSummary[]> {
    return this.withTransaction(() => this.listProfilesUnlocked());
  }

  private findProfileUnlocked(selector: string): EtsyProfileSummary {
    const database = this.readDatabase();
    const selected = resolveProfile(database.credentials, selector);
    const activeShopId = database.index?.activeShopId ?? database.credentials[0]?.shopId;
    return profileSummary(selected, activeShopId ?? selected.shopId);
  }

  async findProfile(selector: string): Promise<EtsyProfileSummary> {
    return this.withTransaction(() => this.findProfileUnlocked(selector));
  }

  private saveUnlocked(credentials: EtsyCredentials, options: SaveCredentialOptions = {}): void {
    const validated = parseCredentials(credentials);
    const previousIndexValue = this.readRaw(ACCOUNT_NAME);
    const database = this.readDatabase();
    const profiles = [...database.credentials];
    const existingIndex = profiles.findIndex((profile) => profile.shopId === validated.shopId);
    if (existingIndex >= 0) profiles[existingIndex] = validated;
    else profiles.push(validated);

    const activeShopId = options.activate === false
      ? database.index?.activeShopId ?? database.credentials[0]?.shopId ?? validated.shopId
      : validated.shopId;

    // During v1 migration, preserve the old shop first. Write credentials before
    // the index so a failed migration leaves the original v1 connection intact.
    const legacy = !database.index ? database.credentials[0] : undefined;
    const legacyAccount = legacy && legacy.shopId !== validated.shopId
      ? profileAccount(legacy.shopId)
      : undefined;
    const targetAccount = profileAccount(validated.shopId);
    const priorTarget = database.index
      ? database.credentials.find((profile) => profile.shopId === validated.shopId)
      : undefined;
    let legacyWriteAttempted = false;
    let targetWriteAttempted = false;
    let indexWriteAttempted = false;

    try {
      if (legacy && legacyAccount) {
        legacyWriteAttempted = true;
        this.writeRaw(legacyAccount, JSON.stringify(legacy));
      }
      targetWriteAttempted = true;
      this.writeRaw(targetAccount, JSON.stringify(validated));
      indexWriteAttempted = true;
      this.writeIndex(profiles, activeShopId);
    } catch {
      let rollbackFailed = false;
      if (indexWriteAttempted) {
        try {
          if (previousIndexValue === null) this.deleteRaw(ACCOUNT_NAME);
          else this.writeRaw(ACCOUNT_NAME, previousIndexValue);
        } catch {
          rollbackFailed = true;
        }
      }
      if (targetWriteAttempted) {
        try {
          if (priorTarget) this.writeRaw(targetAccount, JSON.stringify(priorTarget));
          else this.deleteRaw(targetAccount);
        } catch {
          rollbackFailed = true;
        }
      }
      if (legacyWriteAttempted && legacyAccount) {
        try {
          this.deleteRaw(legacyAccount);
        } catch {
          rollbackFailed = true;
        }
      }
      if (rollbackFailed) {
        throw new CredentialStoreError("The Etsy profile update did not finish cleanly. Check `etsy-mcp-server status` and the operating system credential store before retrying.");
      }
      throw new CredentialStoreError("The Etsy shop profile could not be saved. Existing saved shops were preserved; check the operating system credential store and retry.");
    }
  }

  async save(credentials: EtsyCredentials, options: SaveCredentialOptions = {}): Promise<void> {
    return this.withTransaction(() => this.saveUnlocked(credentials, options));
  }

  async saveRefreshedTokensIfCurrent(expected: EtsyCredentials, updated: EtsyCredentials): Promise<EtsyCredentials> {
    return this.withTransaction(() => {
      const validatedUpdate = parseCredentials(updated);
      if (validatedUpdate.shopId !== expected.shopId) {
        throw new CredentialStoreError("The Etsy token refresh targeted a different shop. Refreshed credentials were not saved.");
      }
      const current = this.readUnlocked(expected.shopId);
      if (!current || !isSameCredential(current, expected)) {
        throw new CredentialStoreError("The Etsy connection changed during token refresh. Refreshed credentials were not saved; restart the MCP client and reconnect if needed.");
      }
      this.saveUnlocked(validatedUpdate, { activate: false });
      return validatedUpdate;
    });
  }

  private setActiveUnlocked(selector: string): EtsyProfileSummary {
    const database = this.readDatabase();
    if (database.credentials.length === 0) {
      throw new CredentialStoreError("No Etsy shop is connected. Run setup first.");
    }
    const selected = resolveProfile(database.credentials, selector);
    if (!database.index) {
      // Convert an existing v1 single-shop entry into a v2 profile index.
      this.saveUnlocked(selected, { activate: true });
    } else if (database.index.activeShopId !== selected.shopId) {
      this.writeIndex(database.credentials, selected.shopId);
    }
    return profileSummary(selected, selected.shopId);
  }

  async setActive(selector: string): Promise<EtsyProfileSummary> {
    return this.withTransaction(() => this.setActiveUnlocked(selector));
  }

  private clearUnlocked(selector?: string): EtsyProfileSummary | null {
    const database = this.readDatabase();
    if (database.credentials.length === 0) return null;

    const activeShopId = database.index?.activeShopId ?? database.credentials[0]?.shopId;
    if (!activeShopId) return null;
    const target = selector === undefined
      ? database.credentials.find((profile) => profile.shopId === activeShopId)
      : resolveProfile(database.credentials, selector);
    if (!target) throw new CredentialStoreError("The active Etsy shop profile could not be found.");
    const summary = profileSummary(target, activeShopId);

    if (!database.index) {
      if (!this.deleteRaw(ACCOUNT_NAME)) {
        throw new CredentialStoreError("The Etsy credential could not be removed from the operating system credential store.");
      }
      return summary;
    }

    const remaining = database.credentials.filter((profile) => profile.shopId !== target.shopId);
    const nextActiveShopId = target.shopId === database.index.activeShopId
      ? remaining[0]?.shopId
      : database.index.activeShopId;

    if (remaining.length > 0 && nextActiveShopId) {
      this.writeIndex(remaining, nextActiveShopId);
      try {
        if (!this.deleteRaw(profileAccount(target.shopId))) throw new Error("credential entry missing");
      } catch {
        try {
          this.writeIndex(database.credentials, database.index.activeShopId);
        } catch {
          throw new CredentialStoreError("Shop disconnection did not finish cleanly. Check `etsy-mcp-server status` and reconnect with setup if needed.");
        }
        throw new CredentialStoreError("The Etsy credential could not be removed from the operating system credential store.");
      }
      return summary;
    }

    if (!this.deleteRaw(profileAccount(target.shopId))) {
      throw new CredentialStoreError("The Etsy credential could not be removed from the operating system credential store.");
    }
    try {
      if (!this.deleteRaw(ACCOUNT_NAME)) throw new Error("profile index missing");
    } catch {
      try {
        this.writeRaw(profileAccount(target.shopId), JSON.stringify(target));
      } catch {
        throw new CredentialStoreError("Shop disconnection did not finish cleanly. Check `etsy-mcp-server status` and reconnect with setup if needed.");
      }
      throw new CredentialStoreError("The Etsy profile index could not be removed. The saved shop connection was restored.");
    }
    return summary;
  }

  async clear(selector?: string): Promise<EtsyProfileSummary | null> {
    return this.withTransaction(() => this.clearUnlocked(selector));
  }

  async clearAll(): Promise<number> {
    return this.withTransaction(() => {
    let removed = 0;
    for (const profile of this.listProfilesUnlocked()) {
      this.clearUnlocked(profile.shopId);
      removed += 1;
    }
    return removed;
    });
  }
}
