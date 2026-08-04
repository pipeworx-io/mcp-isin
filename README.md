# mcp-isin

Securities-identifier validation MCP (ISIN / CUSIP).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `validate_isin` | Validate an ISIN (International Securities Identification Number, ISO 6166 — 12 chars, e.g. "US0378331005"). Checks structure + the mod-10 check digit and returns the ISO country prefix and NSIN. Keyless/offline; does NOT resolve the issuer. |
| `validate_cusip` | Validate a CUSIP (9-char US/Canada securities identifier, e.g. "037833100"). Checks structure + the check digit. |
| `cusip_to_isin` | Convert a CUSIP to its ISIN by prefixing the country code (default "US") and appending the computed ISIN check digit. E.g. CUSIP "037833100" -> "US0378331005". |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "isin": {
      "url": "https://gateway.pipeworx.io/isin/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Isin data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
