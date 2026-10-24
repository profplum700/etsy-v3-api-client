# Claude Desktop extension feasibility

Decision date: 2026-10-24. No `.mcpb` artifact is shipped by this change. Local stdio registration remains the supported installation route.

## What the specification supports

The [official MCPB repository](https://github.com/modelcontextprotocol/mcpb) describes a ZIP-based bundle containing a root `manifest.json`, the server, and dependencies. Its Node bundle layout includes `node_modules`. An npm tarball or source ZIP does not have that layout merely because its suffix changes.

The [manifest specification](https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md) supports a Node entry point, launch arguments, platform overrides, and declared runtime constraints. It requires Node dependencies to be bundled. A potential Etsy bundle can keep `serve` as its launch command, declare Node `>=24.0.0`, and exclude untested platforms. The format itself does not require a hosted server or different Etsy scopes.

The specification page currently labels its header `0.3` while also describing some `0.4` features. The [upstream schema registry](https://github.com/modelcontextprotocol/mcpb/blob/main/src/schemas/index.ts) already registers `0.4`, and the [package manifest](https://github.com/modelcontextprotocol/mcpb/blob/main/package.json) exports versioned schemas. A future build must pin its MCPB CLI and schema together instead of treating the page header or an unpinned `latest` schema as a release contract.

## Why a distributable bundle is deferred

These are unresolved implementation and verification requirements, not evidence that MCPB cannot work.

| Requirement | Inspected fact | Missing proof and completion condition |
| --- | --- | --- |
| Native keyring binaries | The package imports `@napi-rs/keyring`, selects Secret Service explicitly on Linux, and requires Node 24 or later. | Build a standalone production dependency tree for each advertised OS and CPU architecture. Exercise native module loading and synthetic keyring save, read, refresh, and cleanup from the extracted bundle on each target. Do not infer ARM support from x64 CI. |
| Host runtime | MCPB documentation says Claude bundles Node on macOS and Windows. The Etsy package requires `>=24.0.0`. | Record the actual Node version and architecture used by each tested Claude Desktop build. A successful manifest check does not prove that its runtime meets this package's requirement. |
| Secure onboarding | Existing setup uses hidden input in an interactive terminal, a local browser callback, and OS credential storage. The MCP process starts with `serve`. | Demonstrate the complete install-to-setup flow on clean hosts. An MCP stdio pipe is not a terminal for hidden prompts. Retaining a separate terminal setup is viable, but must be documented and tested rather than advertised as one-click authorization. |
| Credential posture | Etsy credentials are not supplied through environment variables or command arguments. | Keep credentials out of MCPB `user_config` substitutions into `env` or `args`, even when a host marks fields sensitive. Preserve the existing OS-store namespace and exact `shops_r listings_r` authorization. |
| Standalone packaging | The repository uses pnpm workspace dependencies. The CLI and server read `../package.json` for their version. | Materialize dependencies without links back to the checkout, preserve the expected package layout, scan the archive for credentials and development files, and verify launch after moving the extracted archive. |
| Client behavior | This task has not installed or exercised an Etsy MCPB in Claude Desktop. | Validate the pinned manifest, pack the bundle, inspect its contents, then test installation, handshake, tool discovery, a permitted read, restart, shop selection, and removal. Verify that removal does not clear saved shop credentials. |
| Release discipline | npm and MCP Registry releases are already tag-driven through `PUBLISHING.md`. | Define a separately reviewed extension-artifact release path with hashes and tested OS/architecture claims. Do not attach an unvalidated extension to an existing package release. |

The repository's npm smoke tests and synthetic native-keyring CI can supply part of this evidence. They do not validate Claude Desktop's bundled runtime or its extension installer. No manifest, packed extension, signature, clean-host installation, or actual extension-runtime test was produced in this review.

## Narrow future implementation

A maintainable first candidate would reuse the existing compiled CLI and complete production dependencies, start `serve`, and require the existing terminal `setup` before first use. It would declare only platforms and architectures for which native dependency and host tests passed. It would not introduce another OAuth implementation, credential store, secret environment variables, or write tools.

Add that candidate only after a pinned schema and runtime experiment clears the requirements above. Otherwise, the manual configuration in the [package README](../packages/etsy-mcp-server/README.md) remains the more reliable route.
