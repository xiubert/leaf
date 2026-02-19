/*
 * PAC 20260218
 */

import React from 'react';
import { SavedQueryRef } from '../../models/Query';
import { FiPlusCircle, FiX } from 'react-icons/fi';
import LoaderIcon from '../Other/LoaderIcon/LoaderIcon';

export interface ComparisonEntry {
    queryId: string;
    label: string;
    color: string;
    loading: boolean;
    error: string | null;
}

interface Props {
    savedQueries: SavedQueryRef[];
    comparisons: ComparisonEntry[];
    showCurrentCohort: boolean;
    onToggleCurrentCohort: () => void;
    onAdd: (queryId: string, label: string) => void;
    onRemove: (queryId: string) => void;
    maxComparisons?: number;
}

interface State {
    selectedQueryId: string;
}

const MAX_DEFAULT = 3;

export default class CohortComparePanel extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { selectedQueryId: '' };
    }

    public render() {
        const { savedQueries, comparisons, showCurrentCohort, maxComparisons = MAX_DEFAULT } = this.props;
        const { selectedQueryId } = this.state;
        const c = 'audiometry-compare';

        const activeIds = new Set(comparisons.map(c => c.queryId));
        const available = savedQueries.filter(q => !activeIds.has(q.id));
        const canAdd = comparisons.length < maxComparisons && available.length > 0;

        return (
            <div className={`${c}-panel`}>
                <div className={`${c}-title`}>Compare Cohorts</div>

                {/* Current cohort toggle */}
                <div className={`${c}-item`}>
                    <span className={`${c}-dot`} style={{ background: 'rgb(30,80,180)' }} />
                    <span className={`${c}-label`}>Current Cohort</span>
                    <input
                        type="checkbox"
                        checked={showCurrentCohort}
                        onChange={this.props.onToggleCurrentCohort}
                        title="Show/hide current cohort"
                    />
                </div>

                {/* Active comparisons */}
                {comparisons.map(comp => (
                    <div key={comp.queryId} className={`${c}-item`}>
                        <span
                            className={`${c}-dot`}
                            style={{ background: comp.color }}
                        />
                        <span className={`${c}-label`} title={comp.label}>
                            {comp.label}
                        </span>
                        {comp.loading && (
                            <span className={`${c}-loading`}>
                                <LoaderIcon size={16} />
                            </span>
                        )}
                        {comp.error && (
                            <span className={`${c}-error`} title={comp.error}>!</span>
                        )}
                        <button
                            className={`${c}-remove`}
                            onClick={() => this.props.onRemove(comp.queryId)}
                            title="Remove comparison"
                        >
                            <FiX />
                        </button>
                    </div>
                ))}

                {/* Add comparison */}
                {canAdd && (
                    <div className={`${c}-add-row`}>
                        <select
                            className={`${c}-select`}
                            value={selectedQueryId}
                            onChange={e => this.setState({ selectedQueryId: e.target.value })}
                        >
                            <option value="">Select saved cohort…</option>
                            {available.map(q => (
                                <option key={q.id} value={q.id}>{q.name}</option>
                            ))}
                        </select>
                        <button
                            className={`${c}-add-btn`}
                            disabled={!selectedQueryId}
                            onClick={this.handleAdd}
                            title="Add comparison"
                        >
                            <FiPlusCircle />
                        </button>
                    </div>
                )}

                {!canAdd && comparisons.length >= maxComparisons && (
                    <div className={`${c}-max-msg`}>Max {maxComparisons} comparisons</div>
                )}
            </div>
        );
    }

    private handleAdd = () => {
        const { selectedQueryId } = this.state;
        if (!selectedQueryId) return;
        const sq = this.props.savedQueries.find(q => q.id === selectedQueryId);
        if (!sq) return;
        this.props.onAdd(sq.id, sq.name);
        this.setState({ selectedQueryId: '' });
    };
}
