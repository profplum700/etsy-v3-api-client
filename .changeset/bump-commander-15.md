---
"@profplum700/etsy-cli": patch
---

Update commander from 12.1.0 to 15.0.0. Command, option and argument syntax is unchanged. Commander 15 is ESM-only and needs Node 22.12 or later, which the package's `engines` (Node 24 or later) already requires. Behaviour change: commands now reject unexpected extra positional arguments with an error instead of ignoring them.
