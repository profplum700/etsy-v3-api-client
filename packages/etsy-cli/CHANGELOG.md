# @profplum700/etsy-cli

## 2.5.6

### Patch Changes

- 32d5650: Update commander from 12.1.0 to 15.0.0. Command, option and argument syntax is unchanged. Commander 15 is ESM-only and needs Node 22.12 or later, which the package's `engines` (Node 24 or later) already requires. Behaviour change: commands now reject unexpected extra positional arguments with an error instead of ignoring them.
- 2fb5522: Bump `inquirer` from 12.10.0 to 14.2.3. The `auth configure` prompts are unchanged.
- 761ff28: Update chalk to v6
- Updated dependencies [f285f3f]
  - @profplum700/etsy-v3-api-client@4.1.0

## 2.5.5

### Patch Changes

- a147325: Add the local, read-only Etsy MCP server and publish the CLI with a semver dependency on the current Etsy client.
- Updated dependencies [a147325]
- Updated dependencies [a147325]
- Updated dependencies [a147325]
  - @profplum700/etsy-v3-api-client@4.0.0
