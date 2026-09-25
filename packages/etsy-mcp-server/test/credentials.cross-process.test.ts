import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface WorkerResult {
  code: number;
  stdout: string;
  stderr: string;
}

const workerPath = fileURLToPath(new URL("./credential-worker.mjs", import.meta.url));

function runWorker(root: string, action: string, shopId?: string): Promise<WorkerResult> {
  const child = spawn(process.execPath, [workerPath, root, action, ...(shopId ? [shopId] : [])], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      await readFile(path);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error("Credential concurrency test did not reach its synchronization point.");
}

async function newStoreDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), "etsy-mcp-credential-race-"));
}

describe("cross-process credential transactions", () => {
  it("does not let an in-flight refresh recreate a profile cleared by another process", async () => {
    const root = await newStoreDirectory();
    try {
      expect((await runWorker(root, "init")).code).toBe(0);
      const refresh = runWorker(root, "refresh-held");
      await waitForFile(join(root, "refresh-paused"));
      const clear = runWorker(root, "clear");
      expect(await clear).toMatchObject({ code: 0, stdout: "ok\n" });
      await writeFile(join(root, "release-refresh"), "release");

      expect(await refresh).toMatchObject({ code: 2 });
      const entries = JSON.parse(await readFile(join(root, "keyring.json"), "utf8")) as Record<string, string>;
      expect(entries.default).toBeUndefined();
      expect(entries["shop-12345"]).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("preserves both profiles when separate processes add shops concurrently", async () => {
    const root = await newStoreDirectory();
    try {
      expect((await runWorker(root, "init")).code).toBe(0);
      const addA = runWorker(root, "add", "23456");
      const addB = runWorker(root, "add", "34567");
      await new Promise((resolve) => setTimeout(resolve, 100));
      await writeFile(join(root, "start-adds"), "start");

      expect(await addA).toMatchObject({ code: 0, stdout: "ok\n" });
      expect(await addB).toMatchObject({ code: 0, stdout: "ok\n" });
      const entries = JSON.parse(await readFile(join(root, "keyring.json"), "utf8")) as Record<string, string>;
      const index = JSON.parse(entries.default ?? "null") as { profiles: Array<{ shopId: string }> };
      expect(index.profiles.map(({ shopId }) => shopId).sort()).toEqual(["12345", "23456", "34567"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("allows only one process to persist a refresh from the same old tokens", async () => {
    const root = await newStoreDirectory();
    try {
      expect((await runWorker(root, "init")).code).toBe(0);
      const refreshA = runWorker(root, "refresh-a");
      const refreshB = runWorker(root, "refresh-b");
      await new Promise((resolve) => setTimeout(resolve, 100));
      await writeFile(join(root, "start-refreshes"), "start");

      const outcomes = await Promise.all([refreshA, refreshB]);
      expect(outcomes.map(({ code }) => code).sort()).toEqual([0, 2]);
      const entries = JSON.parse(await readFile(join(root, "keyring.json"), "utf8")) as Record<string, string>;
      const saved = JSON.parse(entries["shop-12345"] ?? "null") as { accessToken: string };
      expect(["synthetic-refresh-a-access-token", "synthetic-refresh-b-access-token"]).toContain(saved.accessToken);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("fails closed when another process holds the transaction lock past the retry window", async () => {
    const root = await newStoreDirectory();
    try {
      expect((await runWorker(root, "init")).code).toBe(0);
      const holder = runWorker(root, "hold-lock");
      await waitForFile(join(root, "lock-held"));
      const contender = await runWorker(root, "clear");

      expect(contender.code).toBe(1);
      expect(contender.stderr).toContain("The Etsy credential store is locked by process");
      expect(await holder).toMatchObject({ code: 0, stdout: "ok\n" });
      const entries = JSON.parse(await readFile(join(root, "keyring.json"), "utf8")) as Record<string, string>;
      expect(JSON.parse(entries["shop-12345"] ?? "null")).toMatchObject({ shopId: "12345" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
});
