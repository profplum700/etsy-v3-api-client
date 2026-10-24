import assert from "node:assert/strict";
import { execFileSync, execSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(await readFile(join(packageDirectory, "package.json"), "utf8"));
const expectedTools = ["etsy_get_my_shop", "etsy_list_active_listings", "etsy_get_listing_inventory", "etsy_get_listing"];
const temporaryDirectory = await mkdtemp(join(tmpdir(), "etsy-mcp-package-"));
const tar = process.platform === "win32" ? "tar.exe" : "tar";

async function checkStdio(cli) {
  const child = spawn(process.execPath, [cli, "serve"], {
    cwd: temporaryDirectory,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const pending = new Map();
  let nextId = 1;
  let buffer = "";
  let failure;
  let receivedBytes = 0;
  const fail = (message) => {
    failure ??= new Error(message);
    for (const request of pending.values()) request.reject(failure);
    pending.clear();
  };
  child.on("error", () => fail("Installed server could not start."));
  child.stdin.on("error", () => fail("Installed server closed its protocol input unexpectedly."));
  child.on("exit", () => fail("Installed server exited before the protocol check finished."));
  child.stderr.resume();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    receivedBytes += Buffer.byteLength(chunk);
    if (receivedBytes > 262_144) {
      fail("Installed server exceeded the smoke-test output limit.");
      child.kill();
      return;
    }
    buffer += chunk;
    let boundary;
    while ((boundary = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 1);
      try {
        const response = JSON.parse(line);
        assert.equal(response.jsonrpc, "2.0");
        const request = pending.get(response.id);
        if (request) {
          pending.delete(response.id);
          if (response.error) request.reject(new Error("Installed server returned an MCP protocol error."));
          else request.resolve(response.result);
        }
      } catch {
        fail("Installed server wrote non-protocol data to stdout.");
      }
    }
  });
  const send = (message) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    if (failure) return reject(failure);
    const id = nextId++;
    pending.set(id, { resolve, reject });
    send({ id, method, params });
  });
  const timeout = setTimeout(() => {
    fail("Installed server did not finish its MCP handshake within 20 seconds. Check the OS keyring session.");
    child.kill();
  }, 20_000);
  try {
    const initialized = await request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "etsy-package-smoke", version: "1.0.0" },
    });
    assert.equal(initialized.serverInfo.name, "etsy-mcp-server");
    assert.equal(initialized.serverInfo.version, manifest.version);
    assert.equal(typeof initialized.protocolVersion, "string");
    assert.ok(initialized.capabilities.tools);
    send({ method: "notifications/initialized" });
    const { tools, nextCursor } = await request("tools/list");
    assert.equal(nextCursor, undefined);
    assert.deepEqual(tools.map((tool) => tool.name).sort(), [...expectedTools].sort());
    for (const tool of tools) {
      assert.equal(tool.annotations.readOnlyHint, true);
      assert.equal(tool.annotations.destructiveHint, false);
      assert.equal(tool.annotations.idempotentHint, true);
      assert.equal(tool.inputSchema.type, "object");
    }
    await request("ping");
    assert.equal(failure, undefined);
    console.log("PASS installed stdio initialize, tools/list, read-only annotations, and ping (no Etsy requests).");
  } finally {
    clearTimeout(timeout);
    child.stdin.end();
    await new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      const stop = setTimeout(() => child.kill(), 3_000);
      child.once("exit", () => { clearTimeout(stop); resolve(); });
    });
  }
}

try {
  execSync("pnpm pack", { cwd: packageDirectory, stdio: "inherit", timeout: 120_000 });
  const filename = manifest.name.replace(/^@/, "").replace("/", "-") + "-" + manifest.version + ".tgz";
  const tarball = join(temporaryDirectory, filename);
  await copyFile(join(packageDirectory, filename), tarball);
  const files = execFileSync(tar, ["-tf", tarball], { encoding: "utf8" }).trim().split(/\r?\n/);
  for (const file of files) {
    assert.match(file, /^package\/(?:package\.json|README\.md|LICENSE(?:\.md)?|dist\/[\w.-]+\.(?:js|d\.ts)(?:\.map)?)$/, "Unexpected file in npm archive");
  }
  assert.ok(files.includes("package/dist/cli.js"));
  const packedManifest = JSON.parse(execFileSync(tar, ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }));
  assert.equal(packedManifest.name, manifest.name);
  assert.equal(packedManifest.version, manifest.version);
  assert.equal(packedManifest.bin["etsy-mcp-server"], "./dist/cli.js");
  assert.equal(packedManifest.engines.node, ">=24.0.0");
  for (const value of Object.values(packedManifest.dependencies)) assert.doesNotMatch(value, /^(workspace:|file:|link:)/);
  assert.equal(packedManifest.dependencies["@profplum700/etsy-v3-api-client"], manifest.dependencies["@profplum700/etsy-v3-api-client"].replace(/^workspace:/, ""));
  const integrity = createHash("sha512").update(await readFile(tarball)).digest("base64");
  console.log(`PASS packed ${manifest.name}@${manifest.version}, ${files.length} allowed files, sha512-${integrity}`);
  await writeFile(join(temporaryDirectory, "package.json"), JSON.stringify({
    name: "etsy-mcp-package-smoke",
    private: true,
    dependencies: { [manifest.name]: `file:${tarball.replaceAll("\\", "/")}` },
  }));
  execSync("npm install --omit=dev --no-audit --no-fund --package-lock=false", {
    cwd: temporaryDirectory, stdio: "inherit", timeout: 180_000,
  });
  const installedDirectory = join(temporaryDirectory, "node_modules", "@profplum700", "etsy-mcp-server");
  const installedManifest = JSON.parse(await readFile(join(installedDirectory, "package.json"), "utf8"));
  assert.deepEqual(installedManifest, packedManifest);
  const binCommand = process.platform === "win32"
    ? "node_modules\\.bin\\etsy-mcp-server.cmd --help"
    : "./node_modules/.bin/etsy-mcp-server --help";
  const help = execSync(binCommand, { cwd: temporaryDirectory, encoding: "utf8", timeout: 20_000 });
  assert.match(help, /Etsy MCP server \(local stdio, read-only\)/);
  assert.match(help, /etsy-mcp-server serve/);
  console.log(`PASS clean npm production install and installed executable on ${process.platform}/${process.arch}, Node ${process.version}.`);
  await checkStdio(join(installedDirectory, "dist", "cli.js"));
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
