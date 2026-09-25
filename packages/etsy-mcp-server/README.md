# Local Etsy MCP server

This package connects an agent to Etsy shops through a local stdio MCP server. It runs on your computer, uses your Etsy developer app and shop authorizations, and exposes read-only tools. Credentials for each shop stay in the operating system credential store. The MCP server uses one selected shop profile at a time; it does not host an HTTPS service.

## Requirements

- Node.js 24 or later.
- Your own approved Etsy developer app keystring and shared secret.
- A local Etsy callback registered as `http://localhost:3030/oauth/redirect` in the app if Etsy requires it. Etsy's [Quick Start tutorial](https://developers.etsy.com/documentation/tutorials/quickstart/) demonstrates localhost callbacks. Etsy's general [authentication guide](https://developers.etsy.com/documentation/essentials/authentication/) also describes HTTPS callbacks; if Etsy rejects the localhost callback for your app, setup stops without saving credentials.
- On Linux, an unlocked Secret Service keyring such as GNOME Keyring or KeePassXC. This server pins the credential store to Secret Service and will not fall back to a plaintext file or the Linux kernel keyring.

## Connect

Run setup in a local interactive terminal:

```sh
npx --yes @profplum700/etsy-mcp-server@latest setup
```

Enter the keystring and shared secret at the hidden prompts. The setup opens Etsy in your browser and requests only `shops_r` and `listings_r`. After Etsy returns to the local callback, the server verifies the shop and stores the app credentials and OAuth tokens in the operating system credential store. Each successful setup adds or updates that shop's profile and makes it active without replacing other saved shops. No Etsy credential is written to this repository, an environment variable, or a command argument.

To connect another shop, run `setup` again and authorize while signed in to the Etsy account that owns that shop. The active profile is the one the MCP tools query. Switch profiles by name or ID:

```sh
npx --yes @profplum700/etsy-mcp-server@latest status
npx --yes @profplum700/etsy-mcp-server@latest use "Test Shop"
```

If the same Etsy developer app is already saved, you can reuse its credentials and open the authorization request in a specific browser profile without retyping the app secret:

```sh
npx --yes @profplum700/etsy-mcp-server@latest setup --reuse-app --manual-browser
```

Open the displayed Etsy authorization URL in the browser profile signed in to the shop you want to add, approve the requested read permissions, and leave setup running until it confirms the shop. This keeps test and live shop credentials as separate operating-system credential-store profiles.

Setup then asks whether to add the server to your user-level Codex MCP configuration. Choose yes to make it available across your Codex projects. Choose no to configure another client yourself.

Check or disconnect a local profile:

```sh
npx --yes @profplum700/etsy-mcp-server@latest status
npx --yes @profplum700/etsy-mcp-server@latest disconnect
npx --yes @profplum700/etsy-mcp-server@latest disconnect --shop "Test Shop"
npx --yes @profplum700/etsy-mcp-server@latest disconnect --all
npx --yes @profplum700/etsy-mcp-server@latest remove-codex
```

The disconnect command asks before clearing credentials. Without options it disconnects only the active shop; `--shop` targets one profile and `--all` removes every saved profile. Removing the Codex configuration does not clear stored Etsy connections.

## Other stdio MCP clients

Configure the client to launch:

```json
{
  "command": "npx",
  "args": [
    "--yes",
    "@profplum700/etsy-mcp-server@latest",
    "serve"
  ]
}
```

The MCP server communicates over stdin/stdout. Diagnostics go to stderr. Each server process binds to the shop that was active when it started, so an active-shop change cannot silently move an already running agent between shops. Use the `use` command, then restart the MCP client or server to switch shops. Every tool result includes the shop ID it queried.

## Available tools

- `etsy_get_my_shop` — read the connected shop's name, ID, currency, active listing count, and URL.
- `etsy_list_active_listings` — page through active listings with each listing's title, base price, currency, URL, and state. Each page accepts 1–50 results and an offset up to 10,000.
- `etsy_get_listing_inventory` — read variation options, offering prices, and quantities for a listing in the connected shop.

To find listings in a price range, page through active listings and filter the returned prices. The tools do not evaluate shipping destinations or free-postage eligibility. Listing variation prices may differ from a listing's base price.

Every registered tool is read-only. Inventory requests first verify that the listing belongs to the connected shop. The server does not expose write scopes or Etsy mutation tools.

## Prompt for an agent

You can paste this prompt into an agent that can use a local terminal:

> Set up the local Etsy MCP server from the official `@profplum700/etsy-mcp-server` npm package. Do not ask me to paste Etsy credentials into chat or save them in a repository or environment file. Run the setup command in an interactive local terminal so I can enter my own Etsy app keystring and shared secret there. Request only `shops_r` and `listings_r`, verify the connected shop, and offer to add the server to my user-level Codex configuration. If the terminal cannot securely collect the credentials or the OS credential store is unavailable, stop and tell me how to resolve that locally.
