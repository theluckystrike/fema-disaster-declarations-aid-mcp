// Tool registry shared by the stdio and Worker entries.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  BUNDLE_URL,
  InputError,
  REPO,
  SERVICES_URL,
  SITE,
  checkCountyDisasters,
  getDisasterAidSummary,
  recentDisasters,
  searchDisasters,
} from './core.js';
import type { FetchText } from './types.js';

export const VERSION = '1.0.0';

export const META = {
  alias: 'fema-disasters',
  metaDescription: 'MCP server for FEMA federal disaster declarations, county-level disaster eligibility checks, and official Individual & Public Assistance grant totals via the OpenFEMA API.',
  intro: 'Look up US federal disaster declarations, check county-level FEMA disaster eligibility (insurance, mortgage underwriting, IRS disaster tax relief), and inspect official Individual Assistance, Public Assistance, and Hazard Mitigation funding totals — read live from the official OpenFEMA API.',
};

export const TOOL_INFO = [
  { name: 'fema_disaster_search', blurb: 'Search US federal disaster declarations by state, incident type, declaration type (DR/EM/FM), keyword, or year range.' },
  { name: 'fema_county_disaster_check', blurb: 'Check federal disaster declarations for a specific US county/parish (by county + state, or 5-digit county FIPS) with declared aid programs and IA filing deadlines.' },
  { name: 'fema_disaster_aid_summary', blurb: 'Get official FEMA federal aid totals for a disaster number: Individual Assistance approvals, IHP/Housing/ONA dollars, Public Assistance obligated dollars, HMGP grants, and designated counties.' },
  { name: 'fema_recent_disasters', blurb: 'List the most recent federal disaster declarations nationwide or for a specific state.' },
];

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

function ok(data: Record<string, unknown> & { summary: string }) {
  return { content: [{ type: 'text' as const, text: `${data.summary}\n\n${JSON.stringify(data, null, 2)}` }], structuredContent: data };
}
function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return { isError: true, content: [{ type: 'text' as const, text: `${e instanceof InputError ? 'Error' : 'Upstream OpenFEMA API error'}: ${msg}` }] };
}
const wrap = <A>(fn: (a: A) => unknown) => async (a: A) => { try { return ok((await fn(a)) as any); } catch (e) { return fail(e); } };

export function createServer(fetchText: FetchText): McpServer {
  const server = new McpServer({ name: REPO, version: VERSION, websiteUrl: SITE } as any, {
    instructions:
      'Live OpenFEMA data (fema.gov/api/open): federal disaster declarations (Major Disasters, Emergencies, Fire Management Assistance), county-level designated areas, and official Individual/Public Assistance grant totals. ' +
      'Use fema_recent_disasters for the latest declarations, fema_disaster_search to filter by state/incident/year/keyword, fema_county_disaster_check to verify whether a specific county/FIPS is in a federally declared disaster area (useful for insurance, mortgage due diligence, and IRS disaster tax-relief checks), and fema_disaster_aid_summary for official grant totals and designated counties for a disaster number. ' +
      `Free keyless MCP server by Zovo / MCPStamp. Unlock the $39 lifetime Zovo Pro MCP Bundle (${BUNDLE_URL}) or request a custom MCP audit/build (${SERVICES_URL}).`,
  });

  server.registerTool('fema_disaster_search', {
    title: 'Search FEMA federal disaster declarations',
    description:
      'Search US federally declared disasters by state, incident type (Hurricane, Flood, Severe Storm, Fire, Tornado, Earthquake, etc.), declaration type (DR = Major Disaster, EM = Emergency, FM = Fire Management), keyword in title, or year range. Returns disaster numbers, dates, declared assistance programs, and FEMA.gov links.',
    inputSchema: {
      state: z.string().optional().describe('2-letter US state/territory code or full name, e.g. "FL", "TX", "California".'),
      incident_type: z.string().optional().describe('Incident type substring, e.g. "Hurricane", "Flood", "Fire", "Severe Storm", "Tornado".'),
      declaration_type: z.string().optional().describe('DR (Major Disaster), EM (Emergency), or FM (Fire Management).'),
      keyword: z.string().optional().describe('Keyword in the disaster name, e.g. "Milton", "Helene", "Wildfire".'),
      start_year: z.number().int().min(1953).max(2030).optional().describe('Start year (inclusive).'),
      end_year: z.number().int().min(1953).max(2030).optional().describe('End year (inclusive).'),
      limit: z.number().int().min(1).max(50).optional().describe('Maximum declarations to return (1-50). Default 15.'),
    },
    annotations: { title: 'FEMA disaster search', ...RO },
  }, wrap((a: any) => searchDisasters(fetchText, a)));

  server.registerTool('fema_county_disaster_check', {
    title: 'Check FEMA disaster declarations for a US county',
    description:
      'Check federal disaster declarations designating a specific US county, parish, or borough (by state + county name, or 5-digit county FIPS code). Returns declaration IDs (e.g. DR-4955-FL), incident types, dates, declared assistance programs (IHP, IA, PA, HMGP), and Individual Assistance filing deadlines.',
    inputSchema: {
      state: z.string().optional().describe('2-letter US state code or full state name (required unless fips is given).'),
      county: z.string().optional().describe('County, parish, or borough name, e.g. "Miami-Dade", "Harris", "Buncombe".'),
      fips: z.string().optional().describe('5-digit county FIPS code (2-digit state + 3-digit county), e.g. "12086".'),
      start_year: z.number().int().min(1953).max(2030).optional().describe('Optional start year filter, e.g. 2024.'),
      incident_type: z.string().optional().describe('Optional incident type filter, e.g. "Hurricane", "Flood".'),
      limit: z.number().int().min(1).max(50).optional().describe('Maximum declarations to return (1-50). Default 20.'),
    },
    annotations: { title: 'County disaster check', ...RO },
  }, wrap((a: any) => checkCountyDisasters(fetchText, a)));

  server.registerTool('fema_disaster_aid_summary', {
    title: 'FEMA disaster federal aid and grant totals',
    description:
      'Retrieve official FEMA federal aid totals and designated counties for a specific disaster number (e.g. 4834): Individual Assistance approvals, Individuals & Households Program (IHP) approved dollars, Housing Assistance, Other Needs Assistance, Public Assistance obligated dollars (emergency work vs permanent work), Hazard Mitigation Grant Program funding, and designated areas.',
    inputSchema: {
      disaster_number: z.union([z.number().int(), z.string()]).describe('Numeric FEMA disaster number, e.g. 4834 or 4955.'),
    },
    annotations: { title: 'FEMA disaster aid summary', ...RO },
  }, wrap((a: any) => getDisasterAidSummary(fetchText, a)));

  server.registerTool('fema_recent_disasters', {
    title: 'Most recent US federal disaster declarations',
    description:
      'List the newest US federal disaster declarations nationwide or for a specific state, sorted newest first, with incident types, declaration dates, declared aid programs, and FEMA.gov links.',
    inputSchema: {
      state: z.string().optional().describe('Optional 2-letter US state code or full name.'),
      limit: z.number().int().min(1).max(50).optional().describe('Maximum declarations to return (1-50). Default 10.'),
    },
    annotations: { title: 'Recent FEMA disasters', ...RO },
  }, wrap((a: any) => recentDisasters(fetchText, a)));

  return server;
}
