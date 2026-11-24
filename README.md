# fema-disaster-declarations-aid-mcp

US federal disaster declarations, county-level disaster eligibility checks, and official FEMA federal aid totals for AI assistants. Look up recent federal disasters nationwide or by state, verify whether a specific US county or FIPS code has active or historical FEMA declarations (for insurance underwriting, mortgage due diligence, and IRS disaster tax-relief eligibility), and inspect official Individual Assistance, Public Assistance, and Hazard Mitigation grant totals.

This Model Context Protocol (MCP) server reads the official [OpenFEMA API](https://www.fema.gov/about/openfema/api) (`https://www.fema.gov/api/open/`) live at call time. Free hosted endpoint, no API key required.

## Tools

| Tool | What it returns |
| --- | --- |
| `fema_disaster_search` | Search US federal disaster declarations by state, incident type (Hurricane, Flood, Fire, Severe Storm, Tornado, etc.), declaration type (DR, EM, FM), keyword, or year range. |
| `fema_county_disaster_check` | Check federal disaster declarations for a specific US county/parish (by county + state or 5-digit county FIPS) with declared assistance programs and Individual Assistance filing deadlines. |
| `fema_disaster_aid_summary` | Official FEMA federal aid totals for a disaster number: Individual Assistance approvals, IHP/Housing/ONA approved dollars, Public Assistance obligated dollars (emergency vs permanent work), Hazard Mitigation grants, and designated counties. |
| `fema_recent_disasters` | List the most recent federal disaster declarations nationwide or for a specific state, with active aid programs and FEMA.gov links. |

Every tool is read-only and returns structured JSON plus a concise plain-text summary.

## Install

### Free Hosted Endpoint (Claude, ChatGPT developer mode, any remote MCP client)

Paste this URL. No API key, no sign-up:

```
https://fema-disaster-declarations-aid-mcp.lipmichal.workers.dev/mcp
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "fema-disasters": {
      "url": "https://fema-disaster-declarations-aid-mcp.lipmichal.workers.dev/mcp"
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "fema-disasters": {
      "type": "http",
      "url": "https://fema-disaster-declarations-aid-mcp.lipmichal.workers.dev/mcp"
    }
  }
}
```

### Local stdio

```bash
git clone https://github.com/theluckystrike/fema-disaster-declarations-aid-mcp
cd fema-disaster-declarations-aid-mcp
npm install && npm run build
node dist/stdio.js
```

## Example prompts

- "What are the most recent federal disaster declarations in the US?"
- "Has Bay County, Florida had any FEMA federal disaster declarations since 2024?"
- "How much Individual Assistance and Public Assistance has FEMA approved for Disaster 4834?"
- "Find all federal Hurricane disaster declarations in Florida since 2024."

## Upgrade and Commercial Services

- **Zovo Pro MCP Bundle ($39 lifetime):** Unlock the full commercial MCP server collection at [mcp.zovo.one/bundle](https://mcp.zovo.one/bundle?src=sat.fema-disaster-declarations-aid-mcp).
- **Custom MCP Audit and Build Services:** Need a custom internal MCP server, insurance/compliance integration, or security audit? See [mcpstamp.com/services](https://www.mcpstamp.com/services/?src=sat.fema-disaster-declarations-aid-mcp).
- **More Free MCP Servers:** Browse the full directory at [mcpstamp.com/free-servers](https://www.mcpstamp.com/free-servers/?utm_source=mcp&utm_medium=fema-disaster-declarations-aid-mcp).

## Data Sources

See [DATA_SOURCES.md](DATA_SOURCES.md). All data comes directly from the official public OpenFEMA API (`https://www.fema.gov/api/open/`).

## License

MIT
