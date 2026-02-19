/*
 * PAC 20260218
 */

import React from 'react';
import {
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceArea,
    BarChart, Bar, Cell
} from 'recharts';
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
                label: s.label,
                value: s.pta!.mean,
                p25: s.pta!.p25,
                p75: s.pta!.p75,
                count: s.pta!.count,
                color: s.color
            }));

        return (
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>

                {/* Audiogram line chart + legend */}
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
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
                    <div className="audiogram-pta-panel">
                        <div className="audiogram-pta-panel-title">Mean PTA</div>
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
                                <Bar dataKey="value" isAnimationActive={false}>
                                    {ptaBarData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        );
    }

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
                    Mean: <strong>{d.value} dB</strong>&nbsp;
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
