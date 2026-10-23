---
"@profplum700/etsy-mcp-server": patch
---

Update @modelcontextprotocol/server from 2.1.0 to 2.3.0. The server already builds a new McpServer per connection through serveStdio, so the one-connection-per-server rule in 2.3.0 does not affect it. Tool registration and the stdio transport are unchanged.
