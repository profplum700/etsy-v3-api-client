# Local Etsy MCP server

Connect your AI client to an Etsy shop through a local stdio MCP server. The tools read shop and listing data. They cannot change listings, process orders, or send messages. Your Etsy app credentials and OAuth tokens stay in the operating system credential store.

## Prepare your computer

- Install Node.js 24 or later, including npm. Check with `node --version` and `npm --version`.
- Obtain your own approved Etsy developer app keystring and shared secret.
- Register `http://localhost:3030/oauth/redirect` in your Etsy app if required. The [Etsy Quick Start](https://developers.etsy.com/documentation/tutorials/quickstart/) demonstrates localhost callbacks. The [authentication guide](https://developers.etsy.com/documentation/essentials/authentication/) also describes HTTPS callbacks. If Etsy rejects the local callback for your app, setup stops without saving credentials.
- On Windows, run setup and your AI client under the same Windows account with Credential Manager available.
- On macOS, unlock your login Keychain and run setup under the same account as your AI client.
- On Linux, use an unlocked Secret Service implementation such as GNOME Keyring or KeePassXC, accessible through the same desktop D-Bus session. There is no plaintext or Linux kernel-keyring fallback.

A WSL distribution, container, remote development host, and your native desktop are separate execution environments. A connection saved in Windows Credential Manager is not automatically available inside WSL. Keep setup and the MCP process in the same environment and account.

Custom callback URIs passed to the local OAuth API must use loopback HTTP (`localhost`, `127.0.0.1`, or `[::1]`) and an explicit port from 1 to 65535. Unsupported callbacks are rejected before opening a browser.

## Connect your shop

Run this command in a local interactive terminal on macOS or Linux:

```sh
npx --yes @profplum700/etsy-mcp-server@latest setup
```

On Windows, run this in PowerShell. The explicit `.cmd` avoids PowerShell script execution-policy restrictions on npm shims:

```powershell
npx.cmd --yes @profplum700/etsy-mcp-server@latest setup
```

Enter the keystring and shared secret at the hidden prompts. Do not paste them into an AI chat, configuration file, environment variable, or command argument. Setup opens Etsy and requests exactly `shops_r` and `listings_r`. It verifies the shop before saving its credentials in the OS credential store.

When setup offers Codex registration, choose yes only if that is your client. Otherwise choose no and follow the relevant section below. Client registration never replaces Etsy setup.

The examples use npm's `latest` release. For controlled upgrades, replace `@latest` with an exact published version in both setup and client configuration. A source checkout or an unmerged PR can contain features that npm has not released yet.

## Add the server to your AI client

These configurations use local stdio. Keep existing configuration entries and add only the `etsy-mcp-server` entry. Do not configure an HTTP URL or put Etsy secrets in these files.

### Claude Desktop

Open **Settings > Developer > Edit Config**. The standard files are `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS and `%APPDATA%\Claude\claude_desktop_config.json` on Windows. Use Edit Config to locate the file on Linux rather than assuming a path. See the [official local-server guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

On macOS or Linux, add:

```json
{
	"mcpServers": {
		"etsy-mcp-server": {
			"command": "npx",
			"args": ["--yes", "@profplum700/etsy-mcp-server@latest", "serve"]
		}
	}
}
```

On Windows, use the command processor to launch the npm command shim:

```json
{
	"mcpServers": {
		"etsy-mcp-server": {
			"command": "cmd.exe",
			"args": ["/d", "/c", "npx.cmd", "--yes", "@profplum700/etsy-mcp-server@latest", "serve"]
		}
	}
}
```

Quit and reopen Claude Desktop. Check that the server and its tools appear. A GitHub repository import or ZIP import is not an npm MCP installation. This repository does not currently distribute a validated `.mcpb` extension. See the [extension feasibility review](https://github.com/profplum700/etsy-v3-api-client/blob/master/docs/mcpb-feasibility.md).

### Claude Code

On macOS or Linux:

```sh
claude mcp add --transport stdio --scope user etsy-mcp-server -- npx --yes @profplum700/etsy-mcp-server@latest serve
claude mcp list
```

On native Windows in PowerShell:

```powershell
claude mcp add --transport stdio --scope user etsy-mcp-server -- cmd.exe /d /c npx.cmd --yes @profplum700/etsy-mcp-server@latest serve
claude mcp list
```

Use `/mcp` inside Claude Code to inspect the connection. The [Claude Code documentation](https://code.claude.com/docs/en/mcp) describes user scope and the `--` separator. If you use Claude Code in WSL, follow the Linux setup requirements inside WSL.

### OpenAI Codex

If setup already added the server, do not add a duplicate. Otherwise, on macOS or Linux:

```sh
codex mcp add etsy-mcp-server -- npx --yes @profplum700/etsy-mcp-server@latest serve
codex mcp list
```

On native Windows in PowerShell:

```powershell
codex mcp add etsy-mcp-server -- cmd.exe /d /c npx.cmd --yes @profplum700/etsy-mcp-server@latest serve
codex mcp list
```

Restart the relevant local Codex client and inspect `/mcp` in the CLI. [Codex MCP documentation](https://developers.openai.com/codex/mcp) also covers configuration through `config.toml`. This local command does not provision access in a hosted cloud task.

### Cursor

Add the Claude Desktop JSON block for your operating system to your personal Cursor configuration:

- macOS and Linux: `~/.cursor/mcp.json`.
- Windows: `%USERPROFILE%\.cursor\mcp.json`.

Add `"type": "stdio"` inside the `etsy-mcp-server` object. For one project, use `.cursor/mcp.json` in that project instead. Open Cursor's MCP settings and check that `etsy-mcp-server` is enabled and connected. These locations and the `mcpServers` structure follow [Cursor's MCP documentation](https://cursor.com/docs/context/mcp).

### VS Code with GitHub Copilot

For current Copilot harness sessions, open **Chat: Open Customizations > MCP Servers > Add Server**. Select **Command (stdio)** and the global Copilot destination. Enter the command and argument array from the Claude Desktop block for your OS. The personal file is `$COPILOT_HOME/mcp-config.json`, or `~/.copilot/mcp-config.json` when unset. It uses `mcpServers`. See [Add MCP servers](https://code.visualstudio.com/docs/agent-customization/mcp-servers).

For the VS Code configuration format, run **MCP: Open User Configuration**. On macOS or Linux, add:

```json
{
	"servers": {
		"etsy-mcp-server": {
			"type": "stdio",
			"command": "npx",
			"args": ["--yes", "@profplum700/etsy-mcp-server@latest", "serve"]
		}
	}
}
```

On Windows, replace that server's `command` and `args` with:

```json
{
	"command": "cmd.exe",
	"args": ["/d", "/c", "npx.cmd", "--yes", "@profplum700/etsy-mcp-server@latest", "serve"]
}
```

Keep `"type": "stdio"`. For a local workspace configuration, use `.vscode/mcp.json`. Do not copy its `servers` wrapper into the portable Copilot format. The [configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) distinguishes these formats. Restart the server, inspect its output, and enable its tools in the selected Copilot session. A remote workspace needs its own runtime and credential-store access.

### Gemini CLI

Merge the Claude Desktop JSON block for your operating system into your user settings:

- macOS and Linux: `~/.gemini/settings.json`.
- Windows: `%USERPROFILE%\.gemini\settings.json`.

Keep any existing settings alongside `mcpServers`. Restart Gemini CLI, then run `/mcp` to inspect the connection. Leave tool confirmations enabled. The [Gemini CLI MCP guide](https://geminicli.com/docs/tools/mcp-server/) documents this format and the optional `gemini mcp add` registration command.

## Verify the connection

Ask your client to call `etsy_get_my_shop` and show the returned shop ID and name. Confirm that they match the shop you intended. Then ask for one active listing with `etsy_list_active_listings` and `limit: 1`. A configured server or successful startup alone does not prove access to Etsy.

The server communicates over stdin and stdout. Diagnostics go to stderr. A manual `serve` command waits for an MCP client and is not an interactive shell.

Every server process binds to the active shop when it starts. Changing the active shop does not move an already running AI session to another shop. After changing shops, restart that client's MCP server. Successful tool results identify the shop they queried.

## Diagnose local problems

Run the diagnostic from a terminal in the same environment as the client:

```sh
npx --yes @profplum700/etsy-mcp-server@latest doctor
npx --yes @profplum700/etsy-mcp-server@latest doctor --json
```

On Windows, use `npx.cmd` in place of `npx`. The diagnostic checks local prerequisites and saved-connection readiness without making an Etsy request or changing saved credentials. It cannot prove network access, OAuth refresh, client registration, or live API permissions. Its JSON report has `schema_version`, `ok`, and a `checks` array with `code`, `status`, and `message`. Statuses are `pass`, `warn`, or `fail`. A failure returns exit code 1. Warnings alone return exit code 0. It does not print shop names, IDs, local paths, or credential values. Follow the actions it reports. An unreleased source checkout must be built and run locally to test its new diagnostic.

| Symptom | Action |
| --- | --- |
| `node` or `npx` is missing in client output | Install Node.js 24 or later, then restart the client so it inherits PATH. |
| PowerShell refuses to run `npx.ps1` | Use `npx.cmd` in the terminal. Use the Windows configuration above in the client. |
| Linux Secret Service is unavailable | Start and unlock your desktop keyring. Run the client in that same D-Bus session. |
| macOS denies Keychain access | Unlock the login Keychain and review the OS access prompt for the Node process. |
| No saved connection or rejected scopes | Run setup in an interactive terminal and approve only `shops_r` and `listings_r`. |
| Setup cannot bind its callback port | Close the process using port 3030, then rerun setup. Do not change the callback to an unregistered address. |
| Terminal works but a graphical client cannot find the command | Resolve the executable with `command -v npx` on macOS or Linux, or `where.exe npx.cmd` on Windows. Use its absolute path in the client. For Windows paths with spaces, prefer the direct Node launch below. |
| Server connects but returns the previous shop | Select the intended profile, then restart the MCP server in that client. |

To avoid npm startup downloads and Windows command-shim quoting, install a reviewed version globally with `npm install --global @profplum700/etsy-mcp-server@latest`. Use `npm root --global` to find its package directory and `node -p "process.execPath"` to find Node. Configure the absolute Node executable as `command`, with the absolute `<npm-root>/@profplum700/etsy-mcp-server/dist/cli.js` path and `serve` as separate `args`. Keep paths as JSON strings with escaped backslashes on Windows. This fallback still requires the same OS credential store.

## Manage shop profiles

Run setup again to connect another shop. Each successful setup adds or updates that shop and makes it active without replacing other shops.

```sh
npx --yes @profplum700/etsy-mcp-server@latest status
npx --yes @profplum700/etsy-mcp-server@latest use "Test Shop"
npx --yes @profplum700/etsy-mcp-server@latest setup --reuse-app --manual-browser
```

The last command reuses saved developer-app credentials. Open its authorization URL in the browser profile signed in to the intended Etsy account.

```sh
npx --yes @profplum700/etsy-mcp-server@latest disconnect
npx --yes @profplum700/etsy-mcp-server@latest disconnect --shop "Test Shop"
npx --yes @profplum700/etsy-mcp-server@latest disconnect --all
npx --yes @profplum700/etsy-mcp-server@latest remove-codex
```

Use `npx.cmd` on Windows. Disconnect asks before clearing credentials. Without options it targets the active shop. `--shop` targets one saved shop and `--all` clears every shop. Removing the Codex configuration leaves saved Etsy connections intact.

## Available tools

- `etsy_get_my_shop` reads the connected shop's name, ID, currency, active listing count, and URL.
- `etsy_list_active_listings` returns active listings with title, base price, currency, URL, and state. Request 1 to 50 listings per page with offsets up to 10,000.
- `etsy_get_listing` reads a connected-shop listing's title, description, tags, materials, language, state, base price, and URL for a content review. It rejects listings owned by another shop.
- `etsy_get_listing_inventory` returns variation options, prices, and quantities for a listing owned by the connected shop. Follow `next_offset` until it is `null`. Each page contains one entry per offering, so a product can appear more than once.

For a price-range review, page through active listings and filter their base prices. Use inventory for variation prices. These tools do not determine shipping eligibility, profit, order revenue, or conversion rate. All tools remain read-only and request no scopes beyond `shops_r` and `listings_r`.

Client instructions were checked against the linked official documentation on 2026-10-24. They describe supported configuration formats, not a claim that every client and OS combination has been exercised. Consult the implementation report and CI results for executed platform tests.
