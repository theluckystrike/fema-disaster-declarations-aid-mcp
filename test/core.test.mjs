import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  InputError,
  checkCountyDisasters,
  formatUsd,
  getDisasterAidSummary,
  isoDate,
  normalizeState,
  searchDisasters,
} from '../dist/core.js';

function mockFetch(routes) {
  return async (url) => {
    for (const [needle, body] of Object.entries(routes)) {
      if (url.includes(needle)) return JSON.stringify(body);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
}

test('formatUsd, isoDate, and normalizeState work accurately', () => {
  assert.equal(formatUsd(1561125677.16), '$1.56B');
  assert.equal(formatUsd(888074873.55), '$888.07M');
  assert.equal(isoDate('2026-10-27T00:00:00.000Z'), '2026-10-27');
  assert.equal(normalizeState('Florida'), 'FL');
  assert.equal(normalizeState('tx'), 'TX');
  assert.throws(() => normalizeState('Atlantis'), InputError);
});

test('searchDisasters parses FemaWebDisasterDeclarations', async () => {
  const fetchText = mockFetch({
    'FemaWebDisasterDeclarations': {
      metadata: { rundate: '2026-11-24T21:30:00Z' },
      FemaWebDisasterDeclarations: [{
        disasterNumber: 4955,
        disasterName: 'HURRICANE ISAIAS',
        stateCode: 'FL',
        stateName: 'Florida',
        declarationType: 'Major Disaster',
        incidentType: 'Hurricane',
        declarationDate: '2026-10-27T00:00:00.000Z',
        incidentBeginDate: '2026-10-06T00:00:00.000Z',
        incidentEndDate: '2026-10-12T00:00:00.000Z',
        region: 4,
        ihProgramDeclared: true,
        iaProgramDeclared: false,
        paProgramDeclared: true,
        hmProgramDeclared: false,
        disasterPageUrl: 'https://www.fema.gov/disaster/4955',
      }],
    },
  });
  const res = await searchDisasters(fetchText, { state: 'FL', incident_type: 'Hurricane' });
  assert.equal(res.returned, 1);
  assert.equal(res.disasters[0].disaster_number, 4955);
  assert.equal(res.disasters[0].programs_declared.individuals_and_households, true);
  assert.match(res.summary, /4955/);
});

test('checkCountyDisasters validates FIPS and parses county records', async () => {
  await assert.rejects(checkCountyDisasters(async () => '{}', { fips: '123' }), InputError);
  const fetchText = mockFetch({
    'DisasterDeclarationsSummaries': {
      metadata: { rundate: '2026-11-24T21:30:00Z' },
      DisasterDeclarationsSummaries: [{
        femaDeclarationString: 'DR-4955-FL',
        disasterNumber: 4955,
        state: 'FL',
        designatedArea: 'Bay (County)',
        fipsStateCode: '12',
        fipsCountyCode: '005',
        declarationType: 'DR',
        incidentType: 'Hurricane',
        declarationTitle: 'HURRICANE ISAIAS',
        declarationDate: '2026-10-27T00:00:00.000Z',
        fyDeclared: 2027,
        lastIAFilingDate: '2026-12-26T00:00:00.000Z',
        ihProgramDeclared: true,
        iaProgramDeclared: false,
        paProgramDeclared: true,
        hmProgramDeclared: false,
      }],
    },
  });
  const res = await checkCountyDisasters(fetchText, { state: 'FL', county: 'Bay' });
  assert.equal(res.declarations[0].fips, '12005');
  assert.equal(res.declarations[0].last_ia_filing_date, '2026-12-26');
});

test('getDisasterAidSummary combines declaration, aid totals, and designated counties', async () => {
  const fetchText = mockFetch({
    'FemaWebDisasterDeclarations': {
      metadata: { rundate: '2026-11-24T21:30:00Z' },
      FemaWebDisasterDeclarations: [{
        disasterNumber: 4834, disasterName: 'HURRICANE MILTON', stateCode: 'FL', stateName: 'Florida',
        declarationType: 'Major Disaster', incidentType: 'Hurricane', declarationDate: '2024-10-11T00:00:00.000Z',
        ihProgramDeclared: true, paProgramDeclared: true, hmProgramDeclared: true,
      }],
    },
    'FemaWebDisasterSummaries': {
      metadata: { rundate: '2026-11-24T21:30:00Z' },
      FemaWebDisasterSummaries: [{
        disasterNumber: 4834, totalNumberIaApproved: 301675, totalAmountIhpApproved: 888074873.55,
        totalAmountHaApproved: 402606451.59, totalAmountOnaApproved: 485468421.96,
        totalObligatedAmountPa: 1561125677.16, totalObligatedAmountCatAb: 1275112357.84,
        totalObligatedAmountCatC2g: 205492294.25, totalObligatedAmountHmgp: 145453843.14,
        iaLoadDate: '2026-11-24T00:00:00.000Z', paLoadDate: '2026-11-20T00:00:00.000Z',
      }],
    },
    'DisasterDeclarationsSummaries': {
      metadata: { rundate: '2026-11-24T21:30:00Z' },
      DisasterDeclarationsSummaries: [
        { designatedArea: 'Brevard (County)', fipsStateCode: '12', fipsCountyCode: '009' },
        { designatedArea: 'Pinellas (County)', fipsStateCode: '12', fipsCountyCode: '103' },
      ],
    },
  });
  const res = await getDisasterAidSummary(fetchText, { disaster_number: 4834 });
  assert.equal(res.federal_aid.individual_assistance_approvals, 301675);
  assert.equal(res.federal_aid.ihp_approved_usd, '$888.07M');
  assert.equal(res.federal_aid.public_assistance_obligated_usd, '$1.56B');
  assert.equal(res.designated_areas_count, 2);
});
