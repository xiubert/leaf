/*
 * PAC 20260218
 */

import React from 'react';
import {
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceArea
} from 'recharts';
import { AudiogramSummaryPoint } from '../../utils/audiogramData';

interface Props {
    data: AudiogramSummaryPoint[];
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
        const { data, width, height } = this.props;

        // Transform data for recharts Area (needs [p25, p75] range)
        const chartData = data.map(d => ({
            ...d,
            percentileRange: d.p25 != null && d.p75 != null ? [d.p25, d.p75] : [null, null]
        }));

        return (
            <ResponsiveContainer width={width} height={height}>
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>

                    {/* Severity bands */}
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
                        label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -10, fontSize: 13 }}
                    />

                    <YAxis
                        reversed={true}
                        domain={[-10, 120]}
                        ticks={[-10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]}
                        axisLine={{ stroke: '#666' }}
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Hearing Level (dB HL)', angle: -90, position: 'insideLeft', offset: 5, fontSize: 13 }}
                    />

                    {/* 25th-75th percentile band */}
                    <Area
                        dataKey="percentileRange"
                        type="monotone"
                        fill="rgba(100, 150, 220, 0.25)"
                        stroke="none"
                        connectNulls={false}
                    />

                    {/* Mean line */}
                    <Line
                        dataKey="mean"
                        type="monotone"
                        stroke="rgb(30, 80, 180)"
                        strokeWidth={2}
                        dot={{ r: 4, fill: 'rgb(30, 80, 180)' }}
                        connectNulls={false}
                        name="Mean"
                    />

                    <Tooltip content={this.renderTooltip} />
                </ComposedChart>
            </ResponsiveContainer>
        );
    }

    private renderTooltip = (props: any) => {
        const { active, payload } = props;
        if (!active || !payload || !payload.length) return null;

        const data = payload[0]?.payload as AudiogramSummaryPoint;
        if (!data || data.mean == null) return null;

        return (
            <div className="audiogram-tooltip">
                <div className="audiogram-tooltip-header">{data.frequency} Hz</div>
                <div>Mean: <strong>{data.mean} dB</strong></div>
                <div>25th–75th: {data.p25} – {data.p75} dB</div>
                <div>Patients: {data.count}</div>
            </div>
        );
    };
}
