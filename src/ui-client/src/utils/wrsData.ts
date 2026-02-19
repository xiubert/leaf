/*
 * PAC 20260219
 */

import { PatientListDatasetDTO } from '../models/patientList/Dataset';
import { AudiogramRow, rowHasAnyModifier } from './audiogramData';

export interface WrsRow {
    personId:    string;
    encounterId: string;
    testDate:    string;
    L_WRS:       number | null;   // 0–100 %
    R_WRS:       number | null;
    delivery:    string;
    test:        string;
}

export interface WrsScatterPoint {
    pta:      number;
    wrs:      number;
    personId: string;
}

/**
 * Parse a Leaf dynamic-dataset DTO into typed WRS rows.
 * The DTO.results object is keyed by personId; each entry is an array
 * of encounter rows whose column names match the SQL aliases in v_WRS_with_encounter.
 */
export const parseWrsData = (dto: PatientListDatasetDTO): WrsRow[] => {
    const rows: WrsRow[] = [];
    const results = dto.results;

    for (const personId of Object.keys(results)) {
        const patientRows = results[personId];
        if (!patientRows) continue;

        for (const row of patientRows) {
            const r = row as any;
            rows.push({
                personId,
                encounterId: String(r.encounterId ?? r.EncounterId ?? ''),
                testDate:    String(r.testDate    ?? r.TestDate    ?? r.test_date ?? ''),
                L_WRS:       parseWrsValue(r.L_WRS ?? r.l_WRS ?? r.l_wrs),
                R_WRS:       parseWrsValue(r.R_WRS ?? r.r_WRS ?? r.r_wrs),
                delivery:    String(r.delivery ?? r.Delivery ?? ''),
                test:        String(r.test     ?? r.Test     ?? ''),
            });
        }
    }
    return rows;
};

const parseWrsValue = (val: any): number | null => {
    if (val == null) return null;
    const n = parseFloat(String(val).replace('%', '').trim());
    return isNaN(n) ? null : n;
};

/**
 * Build per-patient (PTA, WRS) scatter points for a given ear.
 *
 * WRS – most-recent row per patient where the selected ear's WRS is non-null.
 * PTA – most-recent AIR-conduction row per patient for the selected ear
 *       that has NO threshold modifiers (all T*_mod fields empty/null).
 *       Patients without a qualifying AIR row are excluded.
 *
 * Only patients with both values present are returned.
 */
export const buildWrsScatterData = (
    wrsRows:       WrsRow[],
    audiogramRows: AudiogramRow[],
    side:          'L' | 'R'
): WrsScatterPoint[] => {

    const wrsField: keyof WrsRow = side === 'L' ? 'L_WRS' : 'R_WRS';

    // ── Most-recent WRS per patient ─────────────────────────────────────────
    const wrsByPatient     = new Map<string, number>();
    const wrsDateByPatient = new Map<string, string>();

    for (const row of wrsRows) {
        const val = row[wrsField] as number | null;
        if (val == null) continue;
        const existing = wrsDateByPatient.get(row.personId);
        if (!existing || row.testDate > existing) {
            wrsByPatient.set(row.personId, val);
            wrsDateByPatient.set(row.personId, row.testDate);
        }
    }

    // ── Most-recent unmodified AIR PTA per patient ──────────────────────────
    const ptaByPatient     = new Map<string, number>();
    const ptaDateByPatient = new Map<string, string>();

    for (const row of audiogramRows) {
        if (row.side    !== side)  continue;   // wrong ear
        if (row.type    !== 'AIR') continue;   // must be air conduction
        if (row.ptaLax  == null)   continue;   // must have a PTA value
        if (rowHasAnyModifier(row))continue;   // must have no threshold modifiers

        const existing = ptaDateByPatient.get(row.personId);
        if (!existing || row.testDate > existing) {
            ptaByPatient.set(row.personId, row.ptaLax);
            ptaDateByPatient.set(row.personId, row.testDate);
        }
    }

    // ── Join ────────────────────────────────────────────────────────────────
    const result: WrsScatterPoint[] = [];
    for (const [personId, wrs] of wrsByPatient) {
        const pta = ptaByPatient.get(personId);
        if (pta == null) continue;
        result.push({ personId, pta, wrs });
    }
    return result;
};

// ── Normative helpers (Yellin 1989) ─────────────────────────────────────────
const YELLIN_INTERCEPT = 100.5;
const YELLIN_SLOPE     = -0.704;
const YELLIN_SD        = 16.5;

const yellinExpected = (pta: number): number =>
    Math.max(0, Math.min(100, YELLIN_INTERCEPT + YELLIN_SLOPE * pta));

/**
 * Export WRS scatter data for all visible cohorts as a CSV download.
 *
 * Both ears are always exported regardless of the current scatter ear filter.
 * Included columns:
 *   cohort, personId, ear, wrs_pct, pta_air_dBHL,
 *   expected_wrs_pct (Yellin 1989), norm_sd_diff
 */
export const exportWrsScatterCsv = (
    entries:  Array<{ label: string; pointsL: WrsScatterPoint[]; pointsR: WrsScatterPoint[] }>,
    filename: string = 'wrs_scatter_export.csv'
) => {
    const headers = [
        'cohort', 'personId', 'ear',
        'wrs_pct', 'pta_air_dBHL',
        'expected_wrs_pct', 'norm_sd_diff'
    ];
    const csvRows = [headers.join(',')];

    const addPoints = (label: string, ear: 'L' | 'R', points: WrsScatterPoint[]) => {
        for (const pt of points) {
            const exp    = yellinExpected(pt.pta);
            const sdDiff = (pt.wrs - exp) / YELLIN_SD;
            csvRows.push([
                `"${label}"`,
                pt.personId,
                ear,
                pt.wrs.toFixed(1),
                pt.pta.toFixed(1),
                exp.toFixed(1),
                sdDiff.toFixed(2),
            ].join(','));
        }
    };

    for (const { label, pointsL, pointsR } of entries) {
        addPoints(label, 'L', pointsL);
        addPoints(label, 'R', pointsR);
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};
