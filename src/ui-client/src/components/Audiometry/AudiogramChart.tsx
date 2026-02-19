/*
 * PAC 20260218
 */

import React from 'react';
import {
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceArea,
    BarChart, Bar
} from 'recharts';
import { FiDownload } from 'react-icons/fi';
import { AudiogramSeries, AudiogramSummaryPoint } from '../../utils/audiogramData';

interface Props {
    series: AudiogramSeries[];
    width: number;
    height: number;
}

const SEVERITY_BANDS = [
    { y1: -10, y2: 20,  fill: 'rgba(255,255,255,0)',      label: 'Normal' },
    { y1: 20,  y2: 40,  fill: 'rgba(255,235,150,0.3)',    label: 'Mild' },
    { y1: 40,  y2: 55,  fill: 'rgba(255,210,100,0.35)',   label: 'Moderate' },
    { y1: 55,  y2: 70,  fill: 'rgba(255,180,60,0.35)',    label: 'Mod-Severe' },
    { y1: 70,  y2: 90,  fill: 'rgba(255,150,30,0.4)',     label: 'Severe' },
    { y1: 90,  y2: 120, fill: 'rgba(255,120,0,0.4)',      label: 'Profound' },
];


export default class AudiogramChart extends React.PureComponent<Props> {

    private audiogramRef = React.createRef<HTMLDivElement>();
    private ptaRef       = React.createRef<HTMLDivElement>();

    /** Serialize the recharts SVG inside `ref` and download it as a PNG. */
    private exportChartAsPng = (ref: React.RefObject<HTMLDivElement>, filename: string) => {
        const container = ref.current;
        if (!container) return;

        // recharts stamps its <svg> with class "recharts-surface"; using this
        // selector avoids accidentally picking up any icon SVG in the same div.
        const svg = container.querySelector<SVGSVGElement>('.recharts-surface');
        if (!svg) return;

        const bbox = svg.getBoundingClientRect();
        const w = Math.round(bbox.width);
        const h = Math.round(bbox.height);
        if (!w || !h) return;

        // Clone and stamp explicit pixel dimensions so canvas can render it
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
            const a = document.createElement('a');
            a.href     = canvas.toDataURL('image/png');
            a.download = `${filename}.png`;
            a.click();
            URL.revokeObjectURL(svgUrl);
        };
        img.onerror = () => URL.revokeObjectURL(svgUrl);
        img.src = svgUrl;
    };

    public render() {
        const { series, height } = this.props;

        if (!series || series.length === 0) {
            return null;
        }

        // Build merged chartData: one entry per frequency label
        const freqCount = series[0].data.length;
        const chartData: any[] = [];
        for (let fi = 0; fi < freqCount; fi++) {
            const point: any = { label: series[0].data[fi].label };
            series.forEach((s, si) => {
                const d = s.data[fi];
                point[`mean_${si}`] = d ? d.mean : null;
                point[`range_${si}`] = d && d.p25 != null && d.p75 != null
                    ? [d.p25, d.p75]
                    : [null, null];
                point[`_data_${si}`] = d;
            });
            chartData.push(point);
        }

        // PTA bar data: one entry per series that has pta data
        const ptaBarData = series
            .filter(s => s.pta?.mean != null)
            .map(s => ({
                label:  s.label,
                value:  s.pta!.mean!,
                median: s.pta!.median,
                p25:    s.pta!.p25,
                p75:    s.pta!.p75,
                count:  s.pta!.count,
                values: s.pta!.values,
                color:  s.color
            }));

        return (
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>

                {/* Audiogram line chart + legend */}
                <div ref={this.audiogramRef} style={{ flex: '1 1 auto', minWidth: 0, position: 'relative' }}>
                    <button
                        className="audiogram-export-btn"
                        title="Export audiogram as PNG"
                        onClick={() => this.exportChartAsPng(this.audiogramRef, 'audiogram')}
                    >
                        <FiDownload size={11} /> PNG
                    </button>
                    <ResponsiveContainer width="100%" height={height}>
                        <ComposedChart data={chartData} margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>

                            {SEVERITY_BANDS.map((band, i) => (
                                <ReferenceArea
                                    key={i}
                                    y1={band.y1}
                                    y2={band.y2}
                                    fill={band.fill}
                                    fillOpacity={1}
                                    label={band.label}
                                />
                            ))}

                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />

                            <XAxis
                                dataKey="label"
                                type="category"
                                interval={0}
                                axisLine={{ stroke: '#666' }}
                                tick={{ fontSize: 12 }}
                                label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -15, fontSize: 13 }}
                            />

                            <YAxis
                                reversed={true}
                                domain={[-10, 120]}
                                ticks={[-10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]}
                                axisLine={{ stroke: '#666' }}
                                tick={{ fontSize: 12 }}
                                label={{ value: 'Hearing Level (dB HL)', angle: -90, position: 'insideLeft', offset: 5, fontSize: 13 }}
                            />

                            {series.map((s, si) => {
                                const isFirst = si === 0;
                                const fillRgba = this.colorToRgba(s.color, 0.2);
                                return [
                                    <Area
                                        key={`area_${si}`}
                                        dataKey={`range_${si}`}
                                        type="monotone"
                                        fill={fillRgba}
                                        stroke="none"
                                        connectNulls={false}
                                    />,
                                    <Line
                                        key={`line_${si}`}
                                        dataKey={`mean_${si}`}
                                        type="monotone"
                                        stroke={s.color}
                                        strokeWidth={2}
                                        strokeDasharray={isFirst ? undefined : '6 3'}
                                        dot={{ r: 4, fill: s.color }}
                                        connectNulls={false}
                                        name={s.label}
                                    />
                                ];
                            })}

                            <Tooltip content={this.renderAudiogramTooltip} />
                        </ComposedChart>
                    </ResponsiveContainer>

                    {/* Legend */}
                    {series.length > 1 && (
                        <div className="audiogram-legend">
                            {series.map((s, si) => (
                                <div key={si} className="audiogram-legend-item">
                                    <svg width="28" height="12">
                                        <line
                                            x1="0" y1="6" x2="28" y2="6"
                                            stroke={s.color}
                                            strokeWidth="2.5"
                                            strokeDasharray={si === 0 ? undefined : '6 3'}
                                        />
                                    </svg>
                                    <span>{s.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* PTA bar chart — narrow panel to the right */}
                {ptaBarData.length > 0 && (
                    <div ref={this.ptaRef} className="audiogram-pta-panel">
                        <div className="audiogram-pta-panel-header">
                            <span className="audiogram-pta-panel-title">PTA-3</span>
                            <button
                                className="audiogram-export-btn"
                                title="Export PTA chart as PNG"
                                onClick={() => this.exportChartAsPng(this.ptaRef, 'pta_boxplot')}
                            >
                                <FiDownload size={11} />
                            </button>
                        </div>
                        <ResponsiveContainer width="100%" height={height - 22}>
                            <BarChart
                                data={ptaBarData}
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
                                    domain={[0, 120]}
                                    ticks={[0, 20, 40, 60, 80, 100, 120]}
                                    reversed={true}
                                    tick={{ fontSize: 10 }}
                                    axisLine={{ stroke: '#666' }}
                                    width={32}
                                    label={{ value: 'dB HL', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11 }}
                                />
                                <Tooltip content={this.renderPtaTooltip} />
                                <Bar dataKey="value" isAnimationActive={false} shape={this.renderPtaBox} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        );
    }

    /**
     * Custom bar shape: box plot (P25–P75 box + median line + 1.5×IQR whiskers) with jitter dots.
     *
     * Coordinate math for reversed Y-axis (0 dB at top, 120 dB at bottom):
     *   y           = pixel position of dB=0 (baseline / top of chart area)
     *   y+barHeight = pixel position of dB=mean
     *   toPixelY(v) = y + (v / mean) * barHeight
     *
     * Robustness notes:
     *   - recharts may not pass array fields through the shape props; fall back
     *     to looking up the matching AudiogramSeries from this.props.series.
     *   - A reversed-axis BarChart can emit a negative height; normalise it.
     */
    private renderPtaBox = (props: any) => {
        let { y, height: barHeight } = props;
        const { x, width } = props;

        // Normalise: reversed-axis bars can arrive with negative height
        if (barHeight < 0) { y = y + barHeight; barHeight = -barHeight; }

        // Look up full PTA data from the series prop.
        // recharts does not reliably forward array-valued data fields, so we
        // match the entry by color (a primitive string that is passed reliably).
        const propColor = props.color as string | undefined;
        const match     = this.props.series.find(s => s.color === propColor);
        const pta       = match?.pta;

        const mean   = pta?.mean   ?? (props.value as number | null) ?? null;
        const median = pta?.median ?? null;
        const p25    = pta?.p25    ?? null;
        const p75    = pta?.p75    ?? null;
        const values = pta?.values ?? [];
        const color  = propColor ?? match?.color ?? '#888';

        if (mean == null || barHeight < 1 || values.length === 0) {
            return <g />;
        }

        const toPixelY = (dB: number) => y + (dB / mean) * barHeight;

        // 1.5 × IQR whiskers, clamped to actual data min/max
        const iqr     = (p75 ?? mean) - (p25 ?? mean);
        const sorted  = values as number[];
        const wLow    = Math.max(sorted[0],                   (p25 ?? mean) - 1.5 * iqr);
        const wHigh   = Math.min(sorted[sorted.length - 1],   (p75 ?? mean) + 1.5 * iqr);

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

        // Seeded, deterministic jitter in ±40 % of box width
        const jitter = (i: number, v: number) => {
            const t = Math.sin(i * 12.9898 + v * 43.758) * 43758.5453;
            return (t - Math.floor(t) - 0.5) * boxW * 0.8;
        };

        const MAX_DOTS = 400;
        const step = sorted.length > MAX_DOTS ? Math.ceil(sorted.length / MAX_DOTS) : 1;

        return (
            <g>
                {/* Jitter dots (rendered first, behind box) */}
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
                {/* Upper whisker — toward better hearing (small dB, visually up) */}
                <line x1={cx} y1={yWLow} x2={cx} y2={yP25} stroke={color} strokeWidth={1.5} />
                <line x1={cx - capHalf} y1={yWLow} x2={cx + capHalf} y2={yWLow} stroke={color} strokeWidth={1.5} />
                {/* IQR box */}
                <rect
                    x={boxLeft} y={yP25} width={boxW} height={yP75 - yP25}
                    fill={color} fillOpacity={0.2}
                    stroke={color} strokeWidth={1.5}
                />
                {/* Median line */}
                <line x1={boxLeft} y1={yMed} x2={boxRight} y2={yMed} stroke={color} strokeWidth={2.5} />
                {/* Lower whisker — toward worse hearing (large dB, visually down) */}
                <line x1={cx} y1={yP75} x2={cx} y2={yWHigh} stroke={color} strokeWidth={1.5} />
                <line x1={cx - capHalf} y1={yWHigh} x2={cx + capHalf} y2={yWHigh} stroke={color} strokeWidth={1.5} />
            </g>
        );
    };

    private renderAudiogramTooltip = (props: any) => {
        const { active, payload } = props;
        if (!active || !payload || !payload.length) return null;

        const { series } = this.props;
        const rawPoint = payload[0]?.payload;
        if (!rawPoint) return null;

        const freqLabel = rawPoint.label;
        const hasAny = series.some((_, si) => rawPoint[`_data_${si}`]?.mean != null);
        if (!hasAny) return null;

        return (
            <div className="audiogram-tooltip">
                <div className="audiogram-tooltip-header">{freqLabel} Hz</div>
                {series.map((s, si) => {
                    const d = rawPoint[`_data_${si}`] as AudiogramSummaryPoint | undefined;
                    if (!d || d.mean == null) return null;
                    return (
                        <div key={si} className="audiogram-tooltip-series">
                            <span className="audiogram-tooltip-dot" style={{ background: s.color }} />
                            <strong>{s.label}:</strong>&nbsp;
                            {d.mean} dB&nbsp;
                            <span className="audiogram-tooltip-range">(P25–P75: {d.p25}–{d.p75})</span>
                            &nbsp;<span className="audiogram-tooltip-count">n={d.count}</span>
                        </div>
                    );
                })}
            </div>
        );
    };

    private renderPtaTooltip = (props: any) => {
        const { active, payload } = props;
        if (!active || !payload || !payload.length) return null;
        const d = payload[0]?.payload;
        if (!d || d.value == null) return null;
        return (
            <div className="audiogram-tooltip">
                <div className="audiogram-tooltip-header">{d.label} — PTA</div>
                <div className="audiogram-tooltip-series">
                    <span className="audiogram-tooltip-dot" style={{ background: d.color }} />
                    Median: <strong>{d.median} dB</strong>&nbsp;
                    Mean: {d.value} dB&nbsp;
                    <span className="audiogram-tooltip-range">(P25–P75: {d.p25}–{d.p75})</span>
                    &nbsp;<span className="audiogram-tooltip-count">n={d.count}</span>
                </div>
            </div>
        );
    };

    /** Convert 'rgb(r,g,b)' or '#rrggbb' to 'rgba(r,g,b,alpha)' */
    private colorToRgba = (color: string, alpha: number): string => {
        const rgb = color.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
        }
        return color;
    };
}
