/* 
PAC 20260218
 */

import { PatientListDatasetDTO } from '../models/patientList/Dataset';

export const FREQUENCIES = [125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000] as const;
export type Frequency = typeof FREQUENCIES[number];

const FREQ_KEYS: Record<Frequency, string> = {
    125: 'T125', 250: 'T250', 500: 'T500', 750: 'T750',
    1000: 'T1000', 1500: 'T1500', 2000: 'T2000', 3000: 'T3000',
    4000: 'T4000', 6000: 'T6000', 8000: 'T8000'
};

export interface AudiogramRow {
    personId: string;
    testDate: string;
    side: string;
    type: string;
    thresholds: Map<Frequency, number | null>;
}

export interface AudiogramSummaryPoint {
    frequency: number;
    label: string;
    mean: number | null;
    p25: number | null;
    p75: number | null;
    count: number;
}

export interface AudiogramFilterOptions {
    sides: string[];
    types: string[];
}

/**
 * Parse raw Leaf dataset DTO into typed audiogram rows.
 */
export const parseAudiogramData = (dto: PatientListDatasetDTO): AudiogramRow[] => {
    const rows: AudiogramRow[] = [];
    const results = dto.results;

    for (const personId of Object.keys(results)) {
        const patientRows = results[personId];
        if (!patientRows) continue;

        for (const row of patientRows) {
            const r = row as any;
            const thresholds = new Map<Frequency, number | null>();

            for (const freq of FREQUENCIES) {
                const key = FREQ_KEYS[freq];
                const val = r[key];
                thresholds.set(freq, val != null ? Number(val) : null);
            }

            rows.push({
                personId,
                testDate: r.testDate || r.TestDate || '',
                side: (r.side || r.Side || '').toUpperCase(),
                type: (r.type || r.Type || '').toUpperCase(),
                thresholds
            });
        }
    }
    return rows;
};

/**
 * Extract unique filter values from parsed audiogram data.
 */
export const extractFilterOptions = (rows: AudiogramRow[]): AudiogramFilterOptions => {
    const sides = new Set<string>();
    const types = new Set<string>();
    for (const row of rows) {
        if (row.side) sides.add(row.side);
        if (row.type) types.add(row.type);
    }
    return {
        sides: Array.from(sides).sort(),
        types: Array.from(types).sort()
    };
};

/**
 * Aggregate audiogram data into summary statistics for charting.
 *
 * Logic:
 * 1. Filter rows by selected sides and types
 * 2. For each patient + side + type combo, pick the most recent test date
 * 3. Average across selected combos per patient
 * 4. Compute mean, p25, p75 across all patients per frequency
 */
export const aggregateAudiogramData = (
    rows: AudiogramRow[],
    selectedSides: string[],
    selectedTypes: string[]
): AudiogramSummaryPoint[] => {

    // 1. Filter
    const filtered = rows.filter(r =>
        selectedSides.includes(r.side) && selectedTypes.includes(r.type)
    );

    // 2. Group by patient+side+type, pick most recent
    const grouped = new Map<string, AudiogramRow>();
    for (const row of filtered) {
        const key = `${row.personId}|${row.side}|${row.type}`;
        const existing = grouped.get(key);
        if (!existing || row.testDate > existing.testDate) {
            grouped.set(key, row);
        }
    }

    // 3. Average across side/type combos per patient
    const patientAverages = new Map<string, Map<Frequency, number[]>>();
    for (const row of grouped.values()) {
        if (!patientAverages.has(row.personId)) {
            patientAverages.set(row.personId, new Map());
        }
        const freqMap = patientAverages.get(row.personId)!;
        for (const freq of FREQUENCIES) {
            const val = row.thresholds.get(freq);
            if (val != null) {
                if (!freqMap.has(freq)) freqMap.set(freq, []);
                freqMap.get(freq)!.push(val);
            }
        }
    }

    // Compute per-patient average per frequency
    const patientMeans = new Map<string, Map<Frequency, number>>();
    for (const [pid, freqMap] of patientAverages) {
        const means = new Map<Frequency, number>();
        for (const [freq, vals] of freqMap) {
            means.set(freq, vals.reduce((a, b) => a + b, 0) / vals.length);
        }
        patientMeans.set(pid, means);
    }

    // 4. Compute summary statistics across all patients
    return FREQUENCIES.map(freq => {
        const values: number[] = [];
        for (const means of patientMeans.values()) {
            const val = means.get(freq);
            if (val != null) values.push(val);
        }

        if (values.length === 0) {
            return { frequency: freq, label: formatFreqLabel(freq), mean: null, p25: null, p75: null, count: 0 };
        }

        values.sort((a, b) => a - b);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const p25 = percentile(values, 0.25);
        const p75 = percentile(values, 0.75);

        return {
            frequency: freq,
            label: formatFreqLabel(freq),
            mean: Math.round(mean * 10) / 10,
            p25: Math.round(p25 * 10) / 10,
            p75: Math.round(p75 * 10) / 10,
            count: values.length
        };
    });
};

/**
 * Get the filtered, most-recent-per-combo rows used for chart aggregation.
 */
export const getFilteredRows = (
    rows: AudiogramRow[],
    selectedSides: string[],
    selectedTypes: string[]
): AudiogramRow[] => {
    const filtered = rows.filter(r =>
        selectedSides.includes(r.side) && selectedTypes.includes(r.type)
    );
    const grouped = new Map<string, AudiogramRow>();
    for (const row of filtered) {
        const key = `${row.personId}|${row.side}|${row.type}`;
        const existing = grouped.get(key);
        if (!existing || row.testDate > existing.testDate) {
            grouped.set(key, row);
        }
    }
    return Array.from(grouped.values());
};

/**
 * Export audiogram rows to CSV and trigger download.
 */
export const exportAudiogramCsv = (rows: AudiogramRow[], filename: string = 'audiogram_export.csv') => {
    const headers = ['personId', 'testDate', 'side', 'type',
        ...FREQUENCIES.map(f => `T${f}`)];
    const csvRows = [headers.join(',')];

    for (const row of rows) {
        const vals = [
            row.personId,
            row.testDate,
            row.side,
            row.type,
            ...FREQUENCIES.map(f => {
                const v = row.thresholds.get(f);
                return v != null ? String(v) : '';
            })
        ];
        csvRows.push(vals.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

const formatFreqLabel = (freq: number): string => {
    return freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
};

const percentile = (sorted: number[], p: number): number => {
    const index = p * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};