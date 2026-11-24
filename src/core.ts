// Core business logic for fema-disaster-declarations-aid-mcp.
// Reads the official OpenFEMA API (https://www.fema.gov/api/open/) at call time. No API key required.
import type { FetchText } from './types.js';

export const REPO = 'fema-disaster-declarations-aid-mcp';
export const SITE = 'https://www.mcpstamp.com';
export const UTM = `utm_source=mcp&utm_medium=${REPO}`;
export const BUNDLE_URL = `https://mcp.zovo.one/bundle?src=sat.${REPO}`;
export const SERVICES_URL = `https://www.mcpstamp.com/services/?src=sat.${REPO}`;
const OPENFEMA_BASE = 'https://www.fema.gov/api/open';

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

const STATE_NAMES: Record<string, string> = {
  ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA',
  COLORADO: 'CO', CONNECTICUT: 'CT', DELAWARE: 'DE', 'DISTRICT OF COLUMBIA': 'DC',
  FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID', ILLINOIS: 'IL',
  INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA',
  MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN',
  MISSISSIPPI: 'MS', MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH', OKLAHOMA: 'OK',
  OREGON: 'OR', PENNSYLVANIA: 'PA', 'PUERTO RICO': 'PR', 'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX',
  UTAH: 'UT', VERMONT: 'VT', VIRGINIA: 'VA', WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI', WYOMING: 'WY', GUAM: 'GU', 'VIRGIN ISLANDS': 'VI',
  'AMERICAN SAMOA': 'AS', 'NORTHERN MARIANA ISLANDS': 'MP',
};

const DECL_TYPE_MAP: Record<string, { web: string; code: string }> = {
  DR: { web: 'Major Disaster', code: 'DR' },
  'MAJOR DISASTER': { web: 'Major Disaster', code: 'DR' },
  EM: { web: 'Emergency', code: 'EM' },
  EMERGENCY: { web: 'Emergency', code: 'EM' },
  FM: { web: 'Fire Management', code: 'FM' },
  'FIRE MANAGEMENT': { web: 'Fire Management', code: 'FM' },
};

export function normalizeState(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().toUpperCase();
  if (!cleaned) return undefined;
  if (/^[A-Z]{2}$/.test(cleaned)) return cleaned;
  const mapped = STATE_NAMES[cleaned];
  if (mapped) return mapped;
  throw new InputError(`Unrecognized US state or territory: "${raw}". Use a 2-letter code (e.g. FL, TX, CA) or full state name.`);
}

export function escapeOdataString(raw: string): string {
  return raw.replace(/'/g, "''").replace(/[\r\n]/g, ' ').trim();
}

export function formatUsd(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function isoDate(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s || null;
}

async function femaGet<T extends Record<string, any>>(
  fetchText: FetchText,
  version: 'v1' | 'v2',
  entity: string,
  params: { filter?: string; top?: number; orderby?: string; select?: string },
  cacheTtl = 1800,
): Promise<{ rows: T[]; rundate: string }> {
  const qs = new URLSearchParams();
  if (params.filter) qs.set('$filter', params.filter);
  if (params.top !== undefined) qs.set('$top', String(params.top));
  if (params.orderby) qs.set('$orderby', params.orderby);
  if (params.select) qs.set('$select', params.select);
  const url = `${OPENFEMA_BASE}/${version}/${entity}?${qs.toString()}`;
  const raw = await fetchText(url, { cacheTtl });
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(raw) as Record<string, any>;
  } catch {
    throw new Error('OpenFEMA API returned invalid JSON');
  }
  const rows = Array.isArray(parsed[entity]) ? (parsed[entity] as T[]) : [];
  const rundate = parsed.metadata?.rundate ?? new Date().toISOString();
  return { rows, rundate };
}

function mapWebDeclaration(d: Record<string, any>) {
  return {
    disaster_number: Number(d.disasterNumber),
    disaster_name: d.disasterName ?? null,
    state_code: d.stateCode ?? null,
    state_name: d.stateName ?? null,
    declaration_type: d.declarationType ?? null,
    incident_type: d.incidentType ?? null,
    declaration_date: isoDate(d.declarationDate),
    incident_begin_date: isoDate(d.incidentBeginDate),
    incident_end_date: isoDate(d.incidentEndDate),
    fema_region: d.region ?? null,
    programs_declared: {
      individuals_and_households: Boolean(d.ihProgramDeclared),
      individual_assistance: Boolean(d.iaProgramDeclared),
      public_assistance: Boolean(d.paProgramDeclared),
      hazard_mitigation: Boolean(d.hmProgramDeclared),
    },
    fema_url: d.disasterPageUrl ?? (d.disasterNumber ? `https://www.fema.gov/disaster/${d.disasterNumber}` : null),
  };
}

export async function searchDisasters(fetchText: FetchText, args: {
  state?: string;
  incident_type?: string;
  declaration_type?: string;
  keyword?: string;
  start_year?: number;
  end_year?: number;
  limit?: number;
}) {
  const st = normalizeState(args.state);
  const clauses: string[] = [];
  if (st) clauses.push(`stateCode eq '${st}'`);
  if (args.incident_type) {
    clauses.push(`contains(tolower(incidentType),'${escapeOdataString(args.incident_type.toLowerCase())}')`);
  }
  if (args.declaration_type) {
    const mapped = DECL_TYPE_MAP[args.declaration_type.trim().toUpperCase()];
    if (!mapped) {
      throw new InputError(`Unknown declaration_type "${args.declaration_type}". Use DR (Major Disaster), EM (Emergency), or FM (Fire Management).`);
    }
    clauses.push(`declarationType eq '${mapped.web}'`);
  }
  if (args.keyword) {
    clauses.push(`contains(tolower(disasterName),'${escapeOdataString(args.keyword.toLowerCase())}')`);
  }
  if (args.start_year) {
    clauses.push(`declarationDate ge '${args.start_year}-01-01T00:00:00.000Z'`);
  }
  if (args.end_year) {
    if (args.start_year && args.end_year < args.start_year) {
      throw new InputError('end_year cannot be earlier than start_year.');
    }
    clauses.push(`declarationDate le '${args.end_year}-12-31T23:59:59.999Z'`);
  }

  const limit = Math.min(50, Math.max(1, args.limit ?? 15));
  const { rows, rundate } = await femaGet(fetchText, 'v1', 'FemaWebDisasterDeclarations', {
    filter: clauses.join(' and ') || undefined,
    orderby: 'declarationDate desc',
    top: limit,
  }, 1800);

  const disasters = rows.map(mapWebDeclaration);
  const top = disasters[0];
  const summary = disasters.length === 0
    ? 'No federal disaster declarations matched those filters.'
    : `Found ${disasters.length} FEMA disaster declaration(s) (newest first). Most recent: ${top.disaster_name} (Disaster #${top.disaster_number}, ${top.state_code}, ${top.incident_type}, declared ${top.declaration_date}).`;

  return {
    summary,
    returned: disasters.length,
    disasters,
    as_of: rundate,
    source: 'OpenFEMA API v1 — FemaWebDisasterDeclarations (fema.gov/api/open/v1/FemaWebDisasterDeclarations)',
    more: `${SITE}/free-servers/?${UTM}`,
  };
}

export async function recentDisasters(fetchText: FetchText, args: {
  state?: string;
  limit?: number;
}) {
  return searchDisasters(fetchText, { state: args.state, limit: args.limit ?? 10 });
}

export async function checkCountyDisasters(fetchText: FetchText, args: {
  state?: string;
  county?: string;
  fips?: string;
  start_year?: number;
  incident_type?: string;
  limit?: number;
}) {
  const clauses: string[] = [];
  let label = '';

  if (args.fips) {
    const clean = args.fips.trim().replace(/[^0-9]/g, '');
    if (clean.length !== 5) {
      throw new InputError('fips must be a 5-digit county FIPS code (2-digit state + 3-digit county, e.g. "12086" for Miami-Dade, FL).');
    }
    clauses.push(`fipsStateCode eq '${clean.slice(0, 2)}'`);
    clauses.push(`fipsCountyCode eq '${clean.slice(2, 5)}'`);
    label = `FIPS ${clean}`;
  } else {
    const st = normalizeState(args.state);
    if (!st || !args.county || !args.county.trim()) {
      throw new InputError('Provide either a 5-digit county fips code OR both state and county name.');
    }
    const countyClean = escapeOdataString(
      args.county.trim().replace(/\s+(county|parish|borough|municipality)$/i, '').toLowerCase(),
    );
    clauses.push(`state eq '${st}'`);
    clauses.push(`contains(tolower(designatedArea),'${countyClean}')`);
    label = `${args.county.trim()}, ${st}`;
  }

  if (args.start_year) {
    clauses.push(`declarationDate ge '${args.start_year}-01-01T00:00:00.000Z'`);
  }
  if (args.incident_type) {
    clauses.push(`contains(tolower(incidentType),'${escapeOdataString(args.incident_type.toLowerCase())}')`);
  }

  const limit = Math.min(50, Math.max(1, args.limit ?? 20));
  const { rows, rundate } = await femaGet(fetchText, 'v2', 'DisasterDeclarationsSummaries', {
    filter: clauses.join(' and '),
    orderby: 'declarationDate desc',
    top: limit,
  }, 1800);

  const declarations = rows.map((d) => ({
    fema_declaration_id: d.femaDeclarationString ?? null,
    disaster_number: Number(d.disasterNumber),
    state: d.state ?? null,
    designated_area: d.designatedArea ?? null,
    fips: d.fipsStateCode && d.fipsCountyCode ? `${d.fipsStateCode}${d.fipsCountyCode}` : null,
    declaration_type: d.declarationType ?? null,
    incident_type: d.incidentType ?? null,
    title: d.declarationTitle ?? null,
    declaration_date: isoDate(d.declarationDate),
    fiscal_year: d.fyDeclared ?? null,
    incident_begin_date: isoDate(d.incidentBeginDate),
    incident_end_date: isoDate(d.incidentEndDate),
    last_ia_filing_date: isoDate(d.lastIAFilingDate),
    programs_declared: {
      individuals_and_households: Boolean(d.ihProgramDeclared),
      individual_assistance: Boolean(d.iaProgramDeclared),
      public_assistance: Boolean(d.paProgramDeclared),
      hazard_mitigation: Boolean(d.hmProgramDeclared),
    },
    fema_url: d.disasterNumber ? `https://www.fema.gov/disaster/${d.disasterNumber}` : null,
  }));

  const top = declarations[0];
  const summary = declarations.length === 0
    ? `No federal disaster declarations found for ${label} with the given filters.`
    : `Found ${declarations.length} federal disaster declaration(s) for ${top.designated_area}, ${top.state} (newest first). Most recent: ${top.fema_declaration_id} — ${top.title} (${top.incident_type}, declared ${top.declaration_date}).`;

  return {
    summary,
    query: label,
    returned: declarations.length,
    declarations,
    as_of: rundate,
    source: 'OpenFEMA API v2 — DisasterDeclarationsSummaries (fema.gov/api/open/v2/DisasterDeclarationsSummaries)',
    more: `${SITE}/free-servers/?${UTM}`,
  };
}

export async function getDisasterAidSummary(fetchText: FetchText, args: {
  disaster_number: number | string;
}) {
  const numStr = String(args.disaster_number ?? '').trim().replace(/[^0-9]/g, '');
  if (!numStr) throw new InputError('Provide a valid numeric FEMA disaster_number (e.g. 4834).');
  const num = Number(numStr);

  const [declRes, aidRes, areasRes] = await Promise.all([
    femaGet(fetchText, 'v1', 'FemaWebDisasterDeclarations', { filter: `disasterNumber eq ${num}`, top: 1 }, 3600),
    femaGet(fetchText, 'v1', 'FemaWebDisasterSummaries', { filter: `disasterNumber eq ${num}`, top: 1 }, 1800),
    femaGet(fetchText, 'v2', 'DisasterDeclarationsSummaries', {
      filter: `disasterNumber eq ${num}`,
      select: 'designatedArea,fipsStateCode,fipsCountyCode,ihProgramDeclared,paProgramDeclared,lastIAFilingDate',
      top: 200,
    }, 3600),
  ]);

  if (declRes.rows.length === 0 && aidRes.rows.length === 0) {
    throw new InputError(`No FEMA disaster record found for disaster number ${num}.`);
  }

  const decl = declRes.rows[0] ? mapWebDeclaration(declRes.rows[0]) : null;
  const aidRow = aidRes.rows[0] ?? null;

  const aid = aidRow ? {
    individual_assistance_approvals: aidRow.totalNumberIaApproved ?? null,
    ihp_approved_usd: formatUsd(aidRow.totalAmountIhpApproved),
    ihp_approved_raw: aidRow.totalAmountIhpApproved ?? null,
    housing_assistance_approved_usd: formatUsd(aidRow.totalAmountHaApproved),
    other_needs_assistance_approved_usd: formatUsd(aidRow.totalAmountOnaApproved),
    public_assistance_obligated_usd: formatUsd(aidRow.totalObligatedAmountPa),
    public_assistance_obligated_raw: aidRow.totalObligatedAmountPa ?? null,
    public_assistance_emergency_work_cat_ab_usd: formatUsd(aidRow.totalObligatedAmountCatAb),
    public_assistance_permanent_work_cat_c2g_usd: formatUsd(aidRow.totalObligatedAmountCatC2g),
    hazard_mitigation_obligated_usd: formatUsd(aidRow.totalObligatedAmountHmgp),
    ia_data_as_of: isoDate(aidRow.iaLoadDate),
    pa_data_as_of: isoDate(aidRow.paLoadDate),
  } : null;

  const designatedAreas = Array.from(new Set(areasRes.rows.map((r) => r.designatedArea).filter(Boolean))) as string[];
  const lastIaFiling = areasRes.rows.map((r) => isoDate(r.lastIAFilingDate)).find(Boolean) ?? null;

  const title = decl ? `${decl.disaster_name} (${decl.state_code}, ${decl.incident_type}, declared ${decl.declaration_date})` : `FEMA Disaster #${num}`;
  const aidLine = aid
    ? `IA approvals: ${aid.individual_assistance_approvals ?? 0} (${aid.ihp_approved_usd ?? '$0'} IHP), PA obligated: ${aid.public_assistance_obligated_usd ?? '$0'}, HMGP: ${aid.hazard_mitigation_obligated_usd ?? '$0'}.`
    : 'Federal aid obligation totals have not been posted yet for this disaster.';

  const summary = `FEMA Disaster #${num} — ${title}. Designated areas: ${designatedAreas.length}. ${aidLine}`;

  return {
    summary,
    disaster_number: num,
    declaration: decl,
    last_ia_filing_date: lastIaFiling,
    federal_aid: aid,
    designated_areas_count: designatedAreas.length,
    designated_areas: designatedAreas,
    as_of: aidRes.rundate || declRes.rundate,
    source: 'OpenFEMA API — FemaWebDisasterDeclarations, FemaWebDisasterSummaries & DisasterDeclarationsSummaries',
    more: `${SITE}/free-servers/?${UTM}`,
  };
}
