#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { CODEX_SERVER_NAME, OAUTH_REDIRECT_URI, REQUIRED_SCOPES } from "./constants.js";
import { CredentialStore, CredentialStoreError } from "./credentials.js";
import { connectShop, SetupError } from "./oauth.js";
import { createEtsyMcpServer } from "./tools.js";

interface HiddenInput {
  isTTY?: boolean;
  setRawMode?: (enabled: boolean) => void;
  resume: () => void;
  pause: () => void;
  on: (event: "data", listener: (chunk: Buffer | string) => void) => unknown;
  off: (event: "data", listener: (chunk: Buffer | string) => void) => unknown;
}

interface PromptOutput {
  write: (value: string) => unknown;
}

const packageManifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

export function readHiddenPrompt(
  label: string,
  input: HiddenInput = stdin,
  output: PromptOutput = stdout,
): Promise<string> {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(new SetupError("Run setup in an interactive local terminal so Etsy app credentials are not echoed."));
  }

  output.write(label);
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    let finished = false;
    const finish = (error?: Error): void => {
      if (finished) return;
      finished = true;
      input.off("data", onData);
      input.setRawMode?.(false);
      input.pause();
      output.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk: Buffer | string): void => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") {
          finish(new SetupError("Setup cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            output.write("\b \b");
          }
          continue;
        }
        if (character >= " ") {
          value += character;
          output.write("*");
        }
      }
    };

    input.on("data", onData);
  });
}

async function askYesNo(question: string): Promise<boolean> {
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question(question + " [y/N] ");
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    prompt.close();
  }
}

function runCodexMcp(args: string[]): void {
  const windows = process.platform === "win32";
  const command = windows ? (process.env.ComSpec ?? "cmd.exe") : "codex";
  const commandArgs = windows
    ? ["/d", "/s", "/c", ["codex.cmd", ...args].join(" ")]
    : args;
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new SetupError("Could not update the Codex user configuration. The Etsy connection remains saved; add or remove the server using the Codex MCP commands in the README.");
  }
}

export function registerWithCodex(
  run: (args: string[]) => void = runCodexMcp,
  version = packageManifest.version,
): void {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new SetupError("The installed Etsy MCP package version is invalid. Reinstall the package before registering it with Codex.");
  }
  run([
    "mcp",
    "add",
    CODEX_SERVER_NAME,
    "--",
    "npx",
    "--yes",
    "@profplum700/etsy-mcp-server@" + version,
    "serve",
  ]);
}

export function removeFromCodex(run: (args: string[]) => void = runCodexMcp): void {
  run(["mcp", "remove", CODEX_SERVER_NAME]);
}

interface SetupOptions {
  reuseApp: boolean;
  manualBrowser: boolean;
}

function parseSetupOptions(args: string[]): SetupOptions {
  const allowed = new Set(["--reuse-app", "--manual-browser"]);
  if (args.some((arg) => !allowed.has(arg)) || new Set(args).size !== args.length) {
    throw new SetupError("Usage: etsy-mcp-server setup [--reuse-app] [--manual-browser]");
  }
  return {
    reuseApp: args.includes("--reuse-app"),
    manualBrowser: args.includes("--manual-browser"),
  };
}

async function runSetup(store: CredentialStore, options: SetupOptions): Promise<void> {
  store.probe();
  console.log("Connect your Etsy shop using your own Etsy developer app.");
  console.log("Register this exact callback in your Etsy app if required: " + OAUTH_REDIRECT_URI);
  console.log("The requested OAuth permissions are " + REQUIRED_SCOPES.join(" and ") + " only.");

  let keystring: string;
  let sharedSecret: string;
  if (options.reuseApp) {
    const existing = store.read();
    if (!existing) throw new SetupError("There is no saved Etsy app to reuse. Run setup without --reuse-app first.");
    keystring = existing.keystring;
    sharedSecret = existing.sharedSecret;
    console.log("Reusing the saved Etsy developer app credentials from shop " + existing.shopName + ". They will not be printed.");
  } else {
    keystring = (await readHiddenPrompt("Etsy app keystring (input hidden): ")).trim();
    if (!keystring) throw new SetupError("The Etsy app keystring is required.");
    sharedSecret = (await readHiddenPrompt("Etsy app shared secret (input hidden): ")).trim();
    if (!sharedSecret) throw new SetupError("The Etsy app shared secret is required.");
  }

  if (options.manualBrowser) {
    console.log("Open the authorization URL in the browser profile signed in to the Etsy account you want to connect.");
  }
  const manualBrowserOpener = async (_url: string): Promise<void> => {
    throw new Error("Manual browser mode selected");
  };
  const shop = await connectShop(keystring, sharedSecret, store, options.manualBrowser
    ? { openBrowser: manualBrowserOpener }
    : {});
  console.log("Connected to Etsy shop " + shop.shopName + " (ID " + shop.shopId + "). Credentials are stored in the operating system credential store.");

  if (await askYesNo("Add this server to your user-level Codex MCP configuration?")) {
    registerWithCodex();
    console.log("Added Etsy MCP to your Codex user configuration. Restart Codex to load it.");
  }
}

async function runStatus(store: CredentialStore): Promise<void> {
  const profiles = store.listProfiles();
  if (profiles.length === 0) {
    console.log("Etsy is not connected. Run `npx --yes @profplum700/etsy-mcp-server@latest setup` in a local terminal.");
    return;
  }
  console.log("Connected Etsy shops:");
  for (const profile of profiles) {
    const credentials = store.read(profile.shopId);
    console.log((profile.active ? "* " : "  ") + profile.shopName + " (ID " + profile.shopId + ")" + (profile.active ? " [active]" : ""));
    if (credentials) console.log("    Granted scopes: " + credentials.scope + ".");
  }
  console.log("Credentials are stored in the operating system credential store.");
  console.log("Use `etsy-mcp-server use <shop name or ID>` to select the shop used by the MCP server.");
}

export async function runUse(store: CredentialStore, selector: string): Promise<void> {
  const profile = store.setActive(selector);
  console.log("Active Etsy shop: " + profile.shopName + " (ID " + profile.shopId + ").");
}

export async function runDisconnect(
  store: CredentialStore,
  args: string[],
  confirm: (question: string) => Promise<boolean> = askYesNo,
): Promise<void> {
  const profiles = store.listProfiles();
  if (profiles.length === 0) {
    console.log("No Etsy shops are connected.");
    return;
  }

  if (args.length === 1 && args[0] === "--all") {
    if (!await confirm("Clear credentials for all " + profiles.length + " connected Etsy shops?")) {
      console.log("Cancelled; Etsy connections are unchanged.");
      return;
    }
    const removedCount = store.clearAll();
    console.log("Cleared " + removedCount + " Etsy shop connection(s) from the operating system credential store.");
    return;
  }

  let selector: string | undefined;
  if (args.length === 2 && args[0] === "--shop" && args[1]) {
    selector = args[1];
  } else if (args.length > 0) {
    throw new SetupError("Usage: etsy-mcp-server disconnect [--shop <shop name or ID> | --all]");
  }

  const profile = selector
    ? store.findProfile(selector)
    : profiles.find((candidate) => candidate.active);
  if (!profile) {
    console.log("No active Etsy shop is connected.");
    return;
  }
  if (!await confirm("Disconnect Etsy shop " + profile.shopName + " (ID " + profile.shopId + ")?")) {
    console.log("Cancelled; the Etsy connection is unchanged.");
    return;
  }

  const removed = store.clear(profile.shopId);
  if (removed) console.log("Disconnected Etsy shop " + removed.shopName + " (ID " + removed.shopId + ").");
}

function printHelp(): void {
  console.log("Etsy MCP server (local stdio, read-only)");
  console.log("  etsy-mcp-server setup [--reuse-app] [--manual-browser]");
  console.log("                                           Add or reconnect a shop; reuse the saved app if requested");
  console.log("  etsy-mcp-server serve                     Run the MCP stdio server");
  console.log("  etsy-mcp-server status                    List connected shops and the active shop");
  console.log("  etsy-mcp-server use <shop name or ID>      Select the shop used by the MCP server");
  console.log("  etsy-mcp-server disconnect                Disconnect the active shop only");
  console.log("  etsy-mcp-server disconnect --shop <name>  Disconnect one saved shop");
  console.log("  etsy-mcp-server disconnect --all          Disconnect all saved shops");
  console.log("  etsy-mcp-server remove-codex               Remove the server from Codex user configuration");
}

export function safeCliError(error: unknown): string {
  if (error instanceof CredentialStoreError || error instanceof SetupError) return error.message;
  return "Etsy setup failed. No credential values were printed. Check the local app callback and authorization, then retry.";
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const [command, ...args] = argv;
  const store = new CredentialStore();
  try {
    switch (command) {
      case "setup":
        await runSetup(store, parseSetupOptions(args));
        return;
      case "serve":
        if (args.length > 0) throw new SetupError("Usage: etsy-mcp-server serve");
        console.error("Etsy MCP server running on stdio.");
        await serveStdio(() => createEtsyMcpServer({ store }));
        return;
      case "status":
        if (args.length > 0) throw new SetupError("Usage: etsy-mcp-server status");
        await runStatus(store);
        return;
      case "use":
        if (args.length !== 1) throw new SetupError("Usage: etsy-mcp-server use <shop name or ID>");
        await runUse(store, args[0] ?? "");
        return;
      case "disconnect":
        await runDisconnect(store, args);
        return;
      case "remove-codex":
        if (args.length > 0) throw new SetupError("Usage: etsy-mcp-server remove-codex");
        removeFromCodex();
        console.log("Removed the Etsy MCP server from your Codex user configuration.");
        return;
      case "--help":
      case "-h":
      case "help":
      case undefined:
        printHelp();
        return;
      default:
        throw new SetupError("Unknown command. Use `etsy-mcp-server --help` to see available commands.");
    }
  } catch (error) {
    console.error(safeCliError(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
