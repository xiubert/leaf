/*
 * PAC 20260219
 *
 * WRS vs. PTA scatter plot with normative regression bands,
 * and a companion WRS distribution box plot (right panel).
 *
 * Normative reference: Yellin, Jerger & Fifer (1989)
 *   Expected WRS = max(0, min(100, 100.5 − 0.704 × PTA))
 *   SD ≈ 16.5 %
 *
 * Band shading:
 *   Green  – within ±1 SD of expected  (normal range)
 *   Yellow – between −1 SD and −2 SD   (borderline)
 *   Red    – below −2 SD               (disproportionately poor)
 */

import React from 'react';
import {
    ScatterChart, Scatter, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
    Customized, BarChart, Bar
} from 'recharts';
import { Button, ButtonGroup } from 'reactstrap';
import { FiDownload } from 'react-icons/fi';
import { WrsRow, WrsScatterPoint, buildWrsScatterData, exportWrsScatterCsv } from '../../utils/wrsData';
import { AudiogramRow } from '../../utils/audiogramData';

// ── Normative constants ────────────────────────────────────────────────────
const NORM_INTERCEPT = 100.5;
const NORM_SLOPE     = -0.704;
const NORM_SD        = 16.5;

const normMean = (pta: number): number =>
    Math.max(0, Math.min(100, NORM_INTERCEPT + NORM_SLOPE * pta));

// ── WRS summary stats (for box plot) ──────────────────────────────────────
interface WrsSummary {
    mean:   number | null;
    median: number | null;
    p25:    number | null;
    p75:    number | null;
    count:  number;
    values: number[];   // sorted WRS values
}

const computeWrsSummary = (points: WrsScatterPoint[]): WrsSummary => {
    if (points.length === 0) {
        return { mean: null, median: null, p25: null, p75: null, count: 0, values: [] };
    }
    const vals = points.map(p => p.wrs).sort((a, b) => a - b);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return {
        mean:   Math.round(mean * 10) / 10,
        median: Math.round(pct(vals, 0.50) * 10) / 10,
        p25:    Math.round(pct(vals, 0.25) * 10) / 10,
        p75:    Math.round(pct(vals, 0.75) * 10) / 10,
        count:  vals.length,
        values: vals,
    };
};

const pct = (sorted: number[], p: number): number => {
    const idx   = p * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
};

// ── Props / State ──────────────────────────────────────────────────────────
export interface WrsComparisonEntry {
    label:         string;
    color:         string;
    wrsRows:       WrsRow[];
    audiogramRows: AudiogramRow[];
}

interface WrsSeriesData {
    label:   string;
    color:   string;
    points:  WrsScatterPoint[];
    summary: WrsSummary;
}

interface Props {
    currentWrsRows:       WrsRow[];
    currentAudiogramRows: AudiogramRow[];
    comparisons:          WrsComparisonEntry[];
    showCurrentCohort:    boolean;
    height:               number;
}

interface State {
    selectedEar: 'L' | 'R';
}

// ── Component ──────────────────────────────────────────────────────────────
export default class WrsScatterChart extends React.PureComponent<Props, State> {
    private chartRef   = React.createRef<HTMLDivElement>();
    private wrsBoxRef  = React.createRef<HTMLDivElement>();

    constructor(props: Props) {
        super(props);
        this.state = { selectedEar: 'L' };
    }

    public render() {
        const { height } = this.props;
        const { selectedEar } = this.state;
        const series  = this.buildSeries();
        const hasData = series.some(s => s.points.length > 0);

        // Box plot bar data — one entry per series that has data
        const boxBarData = series
            .filter(s => s.summary.mean != null)
            .map(s => ({
                label:  s.label,
                value:  s.summary.mean!,
                median: s.summary.median,
                p25:    s.summary.p25,
                p75:    s.summary.p75,
                count:  s.summary.count,
                values: s.summary.values,
                color:  s.color,
            }));

        return (
            <div className="wrs-scatter-section">
                <div className="wrs-scatter-header">
                    <span className="wrs-scatter-title">WRS vs. PTA-3 (AIR)</span>
                    <div className="wrs-scatter-controls">
                        <span className="wrs-scatter-filter-label">Ear:</span>
                        <ButtonGroup size="sm">
                            {(['L', 'R'] as const).map(ear => (
                                <Button
                                    key={ear}
                                    color={selectedEar === ear ? 'primary' : 'secondary'}
                                    outline={selectedEar !== ear}
                                    onClick={() => this.setState({ selectedEar: ear })}
                                >
                                    {ear === 'L' ? 'Left' : 'Right'}
                                </Button>
                            ))}
                        </ButtonGroup>
                        <Button size="sm" color="secondary" outline onClick={this.handleExportCsv}>
                            <FiDownload /> Export CSV
                        </Button>
                    </div>
                </div>

                {!hasData ? (
                    <div className="wrs-scatter-empty">
                        No data available for {selectedEar === 'L' ? 'Left' : 'Right'} ear
                        — requires both WRS and unmodified AIR PTA records per patient.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>

                        {/* ── Scatter chart ───────────────────────────────── */}
                        <div ref={this.chartRef} className="wrs-scatter-chart-wrap" style={{ flex: '1 1 auto', minWidth: 0 }}>
                            <button
                                className="audiogram-export-btn"
                                title="Export WRS scatter as PNG"
                                onClick={this.handleExportPng}
                            >
                                <FiDownload size={11} /> PNG
                            </button>

                            <ResponsiveContainer width="100%" height={height}>
                                <ScatterChart margin={{ top: 10, right: 40, bottom: 44, left: 20 }}>
                                    {/* Normative bands — drawn first so dots appear on top */}
                                    <Customized component={this.renderNormativeBands} />

                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />

                                    <XAxis
                                        dataKey="pta"
                                        type="number"
                                        domain={[0, 120]}
                                        ticks={[0, 20, 40, 60, 80, 100, 120]}
                                        name="PTA"
                                        axisLine={{ stroke: '#666' }}
                                        tick={{ fontSize: 11 }}
                                        label={{
                                            value: 'PTA (dB HL)',
                                            position: 'insideBottom',
                                            offset: -26,
                                            fontSize: 12
                                        }}
                                    />

                                    <YAxis
                                        dataKey="wrs"
                                        type="number"
                                        domain={[0, 100]}
                                        ticks={[0, 20, 40, 60, 80, 100]}
                                        name="WRS"
                                        axisLine={{ stroke: '#666' }}
                                        tick={{ fontSize: 11 }}
                                        label={{
                                            value: 'WRS (%)',
                                            angle: -90,
                                            position: 'insideLeft',
                                            offset: 5,
                                            fontSize: 12
                                        }}
                                    />

                                    {series.map((s, si) => (
                                        <Scatter
                                            key={si}
                                            name={s.label}
                                            data={s.points}
                                            fill={s.color}
                                            fillOpacity={0.7}
                                            r={4}
                                            isAnimationActive={false}
                                        />
                                    ))}

                                    <Tooltip
                                        content={this.renderScatterTooltip}
                                        cursor={{ strokeDasharray: '3 3' }}
                                    />
                                </ScatterChart>
                            </ResponsiveContainer>

                            {/* Cohort legend (only when multiple series) */}
                            {series.length > 1 && (
                                <div className="wrs-scatter-legend">
                                    {series.map((s, si) => (
                                        <div key={si} className="wrs-scatter-legend-item">
                                            <span
                                                className="wrs-scatter-legend-dot"
                                                style={{ background: s.color }}
                                            />
                                            <span>{s.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Normative band legend */}
                            <div className="wrs-scatter-norm-legend">
                                <span className="wrs-norm-band wrs-norm-normal" />
                                <span>Expected (±1 SD)</span>
                                <span className="wrs-norm-band wrs-norm-borderline" />
                                <span>Borderline (−1 to −2 SD)</span>
                                <span className="wrs-norm-band wrs-norm-poor" />
                                <span>Disproportionate (&lt; −2 SD)</span>
                                <span className="wrs-norm-line-swatch" />
                                <span>Normative mean (Yellin 1989)</span>
                            </div>
                        </div>

                        {/* ── WRS distribution box plot ────────────────────── */}
                        {boxBarData.length > 0 && (
                            <div ref={this.wrsBoxRef} className="wrs-box-panel">
                                <div className="wrs-box-panel-header">
                                    <span className="wrs-box-panel-title">WRS</span>
                                    <button
                                        className="audiogram-export-btn"
                                        title="Export WRS box plot as PNG"
                                        onClick={this.handleExportBoxPng}
                                    >
                                        <FiDownload size={11} />
                                    </button>
                                </div>
                                <ResponsiveContainer width="100%" height={height - 22}>
                                    <BarChart
                                        data={boxBarData}
                                        margin={{ top: 4, right: 8, bottom: 44, left: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" vertical={false} />
                                        <XAxis
                                            dataKey="label"
                                            tick={{ fontSize: 9 }}
                                            axisLine={{ stroke: '#666' }}
                                            interval={0}
                                            angle={-35}
                                            textAnchor="end"
                                            height={50}
                                        />
                                        <YAxis
                                            domain={[0, 100]}
                                            ticks={[0, 20, 40, 60, 80, 100]}
                                            tick={{ fontSize: 10 }}
                                            axisLine={{ stroke: '#666' }}
                                            width={32}
                                            label={{ value: 'WRS %', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11 }}
                                        />
                                        <Tooltip content={this.renderBoxTooltip} />
                                        <Bar dataKey="value" isAnimationActive={false} shape={this.renderWrsBox} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── Data builder ─────────────────────────────────────────────────────────
    private buildSeries = (): WrsSeriesData[] => {
        const { currentWrsRows, currentAudiogramRows, comparisons, showCurrentCohort } = this.props;
        const { selectedEar } = this.state;
        const result: WrsSeriesData[] = [];

        if (showCurrentCohort) {
            const points = buildWrsScatterData(currentWrsRows, currentAudiogramRows, selectedEar);
            result.push({
                label:   'Current Cohort',
                color:   'rgb(30,80,180)',
                points,
                summary: computeWrsSummary(points),
            });
        }

        for (const comp of comparisons) {
            const points = buildWrsScatterData(comp.wrsRows, comp.audiogramRows, selectedEar);
            result.push({
                label:   comp.label,
                color:   comp.color,
                points,
                summary: computeWrsSummary(points),
            });
        }

        return result;
    };

    // ── Normative band overlay ────────────────────────────────────────────────
    private renderNormativeBands = (props: any): React.ReactElement => {
        const xAxis = props.xAxisMap && (props.xAxisMap[0] ?? Object.values(props.xAxisMap)[0]);
        const yAxis = props.yAxisMap && (props.yAxisMap[0] ?? Object.values(props.yAxisMap)[0]);
        if (!xAxis?.scale || !yAxis?.scale) return <g />;

        const toX = (pta: number) => xAxis.scale(pta);
        const toY = (wrs: number) => yAxis.scale(wrs);

        const ptas   = Array.from({ length: 61 }, (_, i) => i * 2);
        const sd1up  = ptas.map(p => [toX(p), toY(Math.min(100, normMean(p) + NORM_SD))]);
        const sd1lo  = ptas.map(p => [toX(p), toY(Math.max(0,   normMean(p) - NORM_SD))]);
        const sd2lo  = ptas.map(p => [toX(p), toY(Math.max(0,   normMean(p) - 2 * NORM_SD))]);
        const bottom = ptas.map(p => [toX(p), toY(0)]);
        const mean   = ptas.map(p => [toX(p), toY(normMean(p))]);

        const toPts = (arr: number[][]) => arr.map(([x, y]) => `${x},${y}`).join(' ');

        return (
            <g>
                <polygon points={toPts([...sd2lo,  ...[...bottom].reverse()])} fill="rgba(255,80,80,0.18)"   stroke="none" />
                <polygon points={toPts([...sd1lo,  ...[...sd2lo].reverse()])}  fill="rgba(255,180,50,0.22)"  stroke="none" />
                <polygon points={toPts([...sd1up,  ...[...sd1lo].reverse()])}  fill="rgba(100,200,100,0.18)" stroke="none" />
                <polyline points={toPts(mean)} fill="none" stroke="rgba(40,130,40,0.65)" strokeWidth={1.5} strokeDasharray="6 3" />
            </g>
        );
    };

    // ── WRS box plot shape ────────────────────────────────────────────────────
    /**
     * Custom BarChart shape: box plot for WRS distribution.
     *
     * Coordinate math for a NON-reversed Y axis (0% at bottom, 100% at top):
     *   y           = pixel position of mean% (bar top)
     *   y + barH    = pixel position of 0%   (baseline)
     *   toPixelY(v) = (y + barH) - (v / mean) * barH
     *
     * Since recharts looks up series color via `props.color` (not reliably
     * forwarded for array-valued fields), we match by color against buildSeries.
     */
    private renderWrsBox = (props: any): React.ReactElement => {
        let { y, height: barH } = props;
        const { x, width } = props;

        if (barH < 0) { y = y + barH; barH = -barH; }

        const propColor = props.color as string | undefined;
        const series    = this.buildSeries();
        const match     = series.find(s => s.color === propColor);
        const summary   = match?.summary;

        const mean   = summary?.mean   ?? (props.value as number | null) ?? null;
        const median = summary?.median ?? null;
        const p25    = summary?.p25    ?? null;
        const p75    = summary?.p75    ?? null;
        const values = summary?.values ?? [];
        const color  = propColor ?? match?.color ?? '#888';

        if (mean == null || barH < 1 || values.length === 0) return <g />;

        // For non-reversed Y axis: 0% is at the bottom (large pixel y),
        // 100% is at the top (small pixel y).
        const yBaseline  = y + barH;                              // pixel for 0%
        const toPixelY   = (v: number) => yBaseline - (v / mean) * barH;

        const iqr    = (p75 ?? mean) - (p25 ?? mean);
        const sorted = values;
        const wLow   = Math.max(sorted[0],                  (p25 ?? mean) - 1.5 * iqr);
        const wHigh  = Math.min(sorted[sorted.length - 1],  (p75 ?? mean) + 1.5 * iqr);

        const yWLow  = toPixelY(wLow);
        const yP25   = toPixelY(p25 ?? mean);
        const yMed   = toPixelY(median ?? mean);
        const yP75   = toPixelY(p75 ?? mean);
        const yWHigh = toPixelY(wHigh);

        const cx       = x + width / 2;
        const boxLeft  = x + width * 0.2;
        const boxRight = x + width * 0.8;
        const boxW     = boxRight - boxLeft;
        const capHalf  = boxW * 0.35;

        const jitter = (i: number, v: number) => {
            const t = Math.sin(i * 12.9898 + v * 43.758) * 43758.5453;
            return (t - Math.floor(t) - 0.5) * boxW * 0.8;
        };

        const MAX_DOTS = 400;
        const step = sorted.length > MAX_DOTS ? Math.ceil(sorted.length / MAX_DOTS) : 1;

        return (
            <g>
                {/* Jitter dots (behind box) */}
                {sorted
                    .filter((_, i) => i % step === 0)
                    .map((v, i) => (
                        <circle
                            key={i}
                            cx={cx + jitter(i, v)}
                            cy={toPixelY(v)}
                            r={1.5}
                            fill={color}
                            fillOpacity={0.25}
                            stroke="none"
                        />
                    ))
                }
                {/* Lower whisker — toward worse WRS (small %, visually down) */}
                <line x1={cx} y1={yWLow} x2={cx} y2={yP25} stroke={color} strokeWidth={1.5} />
                <line x1={cx - capHalf} y1={yWLow} x2={cx + capHalf} y2={yWLow} stroke={color} strokeWidth={1.5} />
                {/* IQR box */}
                <rect
                    x={boxLeft} y={yP75} width={boxW} height={yP25 - yP75}
                    fill={color} fillOpacity={0.2}
                    stroke={color} strokeWidth={1.5}
                />
                {/* Median line */}
                <line x1={boxLeft} y1={yMed} x2={boxRight} y2={yMed} stroke={color} strokeWidth={2.5} />
                {/* Upper whisker — toward better WRS (large %, visually up) */}
                <line x1={cx} y1={yP25} x2={cx} y2={yWHigh} stroke={color} strokeWidth={1.5} />
                <line x1={cx - capHalf} y1={yWHigh} x2={cx + capHalf} y2={yWHigh} stroke={color} strokeWidth={1.5} />
            </g>
        );
    };

    // ── Tooltips ─────────────────────────────────────────────────────────────
    private renderScatterTooltip = (props: any) => {
        const { active, payload } = props;
        if (!active || !payload || !payload.length) return null;
        const pt = payload[0]?.payload as WrsScatterPoint | undefined;
        if (!pt) return null;

        const expected  = normMean(pt.pta);
        const sdDiff    = (pt.wrs - expected) / NORM_SD;
        const diffColor = sdDiff < -2 ? '#c0392b' : sdDiff < -1 ? '#e67e22' : '#27ae60';

        return (
            <div className="audiogram-tooltip">
                <div className="audiogram-tooltip-header">Patient {pt.personId}</div>
                <div className="audiogram-tooltip-series">PTA:&nbsp;<strong>{pt.pta.toFixed(1)} dB HL</strong></div>
                <div className="audiogram-tooltip-series">WRS:&nbsp;<strong>{pt.wrs.toFixed(1)}%</strong></div>
                <div className="audiogram-tooltip-series" style={{ color: diffColor }}>
                    Expected: {expected.toFixed(1)}%&nbsp;
                    <span className="audiogram-tooltip-range">({sdDiff > 0 ? '+' : ''}{sdDiff.toFixed(1)} SD)</span>
                </div>
            </div>
        );
    };

    private renderBoxTooltip = (props: any) => {
        const { active, payload } = props;
        if (!active || !payload || !payload.length) return null;
        const d = payload[0]?.payload;
        if (!d || d.value == null) return null;
        return (
            <div className="audiogram-tooltip">
                <div className="audiogram-tooltip-header">{d.label} — WRS</div>
                <div className="audiogram-tooltip-series">
                    <span className="audiogram-tooltip-dot" style={{ background: d.color }} />
                    Median: <strong>{d.median}%</strong>&nbsp;
                    Mean: {d.value}%&nbsp;
                    <span className="audiogram-tooltip-range">(P25–P75: {d.p25}–{d.p75}%)</span>
                    &nbsp;<span className="audiogram-tooltip-count">n={d.count}</span>
                </div>
            </div>
        );
    };

    // ── CSV export ────────────────────────────────────────────────────────────
    private handleExportCsv = () => {
        const { currentWrsRows, currentAudiogramRows, comparisons, showCurrentCohort } = this.props;

        const entries: Array<{ label: string; pointsL: any[]; pointsR: any[] }> = [];

        if (showCurrentCohort) {
            entries.push({
                label:   'Current Cohort',
                pointsL: buildWrsScatterData(currentWrsRows, currentAudiogramRows, 'L'),
                pointsR: buildWrsScatterData(currentWrsRows, currentAudiogramRows, 'R'),
            });
        }

        for (const comp of comparisons) {
            entries.push({
                label:   comp.label,
                pointsL: buildWrsScatterData(comp.wrsRows, comp.audiogramRows, 'L'),
                pointsR: buildWrsScatterData(comp.wrsRows, comp.audiogramRows, 'R'),
            });
        }

        exportWrsScatterCsv(entries, 'wrs_scatter_export.csv');
    };

    // ── PNG exports ───────────────────────────────────────────────────────────
    private handleExportPng = () => {
        this.exportRef(this.chartRef, 'wrs_pta_scatter.png');
    };

    private handleExportBoxPng = () => {
        this.exportRef(this.wrsBoxRef, 'wrs_boxplot.png');
    };

    private exportRef = (ref: React.RefObject<HTMLDivElement>, filename: string) => {
        const container = ref.current;
        if (!container) return;

        const svg = container.querySelector<SVGSVGElement>('.recharts-surface');
        if (!svg) return;

        const bbox = svg.getBoundingClientRect();
        const w    = Math.round(bbox.width);
        const h    = Math.round(bbox.height);
        if (!w || !h) return;

        const clone = svg.cloneNode(true) as SVGSVGElement;
        clone.setAttribute('width',  String(w));
        clone.setAttribute('height', String(h));
        if (!clone.getAttribute('viewBox')) {
            clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
        }

        const svgStr  = new XMLSerializer().serializeToString(clone);
        const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl  = URL.createObjectURL(svgBlob);

        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(svgUrl); return; }

        const img = new Image();
        img.onload = () => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const a    = document.createElement('a');
            a.href     = canvas.toDataURL('image/png');
            a.download = filename;
            a.click();
            URL.revokeObjectURL(svgUrl);
        };
        img.onerror = () => URL.revokeObjectURL(svgUrl);
        img.src = svgUrl;
    };
}
