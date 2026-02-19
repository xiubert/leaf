/*
 * PAC 20260218
 */

import React from 'react';
import { connect } from 'react-redux';
import { AppState } from '../../models/state/AppState';
import { CohortStateType } from '../../models/state/CohortState';
import { SavedQueryRef } from '../../models/Query';
import { PatientListDatasetDTO } from '../../models/patientList/Dataset';
import { findAudiogramDatasetId, fetchAudiogramData } from '../../services/audiometryApi';
import {
    AudiogramRow, AudiogramFilterOptions, AudiogramSeries,
    parseAudiogramData, extractFilterOptions, aggregateAudiogramData, computePtaSummary,
    getFilteredRows, exportMultiSeriesCsv
} from '../../utils/audiogramData';
import AudiogramChart from '../../components/Audiometry/AudiogramChart';
import AudiogramFilters from '../../components/Audiometry/AudiogramFilters';
import CohortComparePanel, { ComparisonEntry } from '../../components/Audiometry/CohortComparePanel';
import { Button } from 'reactstrap';
import { FiDownload } from 'react-icons/fi';
import LoaderIcon from '../../components/Other/LoaderIcon/LoaderIcon';
import computeDimensions from '../../utils/computeDimensions';
import './Audiometry.css';

const COMPARISON_COLORS = [
    'rgb(230,74,100)',
    'rgb(40,160,100)',
    'rgb(130,60,200)',
];
const CURRENT_COLOR = 'rgb(30,80,180)';

interface OwnProps {}
interface StateProps {
    queryId: string;
    cohortLoaded: boolean;
    appState: AppState;
    savedQueries: SavedQueryRef[];
}
interface DispatchProps {}
type Props = StateProps & OwnProps & DispatchProps;

interface ComparisonState {
    queryId: string;
    label: string;
    color: string;
    loading: boolean;
    error: string | null;
    rows: AudiogramRow[];
}

interface State {
    loading: boolean;
    error: string | null;
    rows: AudiogramRow[];
    filterOptions: AudiogramFilterOptions;
    selectedSides: string[];
    selectedTypes: string[];
    width: number;
    height: number;
    comparisons: ComparisonState[];
    showCurrentCohort: boolean;
    excludeModified: boolean;
}

class Audiometry extends React.PureComponent<Props, State> {
    private prevQueryId: string = '';

    constructor(props: Props) {
        super(props);
        const dim = this.getDimensions();
        this.state = {
            loading: false,
            error: null,
            rows: [],
            filterOptions: { sides: [], types: [] },
            selectedSides: [],
            selectedTypes: [],
            width: dim.width,
            height: dim.height,
            comparisons: [],
            showCurrentCohort: true,
            excludeModified: false
        };
    }

    public componentDidMount() {
        window.addEventListener('resize', this.handleResize);
        this.handleResize();
        if (this.props.cohortLoaded && this.props.queryId) {
            this.loadData();
        }
    }

    public componentDidUpdate() {
        if (this.props.cohortLoaded && this.props.queryId &&
            this.props.queryId !== this.prevQueryId) {
            this.loadData();
        }
    }

    public componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }

    public render() {
        const { cohortLoaded, savedQueries } = this.props;
        const { loading, error, filterOptions, selectedSides, selectedTypes,
                width, height, comparisons, showCurrentCohort, excludeModified } = this.state;
        const c = 'audiometry';

        if (!cohortLoaded) {
            return (
                <div className={`${c}-container ${c}-empty`}>
                    <p>Run a cohort query to view audiometry data.</p>
                </div>
            );
        }

        if (loading) {
            return (
                <div className={`${c}-container ${c}-loading`}>
                    <LoaderIcon size={100} />
                </div>
            );
        }

        if (error) {
            return (
                <div className={`${c}-container ${c}-error`}>
                    <p>{error}</p>
                </div>
            );
        }

        if (filterOptions.sides.length === 0) {
            return (
                <div className={`${c}-container ${c}-empty`}>
                    <p>No audiogram data found for this cohort.</p>
                </div>
            );
        }

        const chartWidth = Math.max(width - 40, 400);
        const chartHeight = Math.max(height - 200, 280);

        const series = this.buildSeries();

        const compEntries: ComparisonEntry[] = comparisons.map(comp => ({
            queryId: comp.queryId,
            label: comp.label,
            color: comp.color,
            loading: comp.loading,
            error: comp.error
        }));

        return (
            <div className={`${c}-container scrollable-offset-by-header`}>
                <div className={`${c}-toolbar`}>
                    <AudiogramFilters
                        availableSides={filterOptions.sides}
                        availableTypes={filterOptions.types}
                        selectedSides={selectedSides}
                        selectedTypes={selectedTypes}
                        excludeModified={excludeModified}
                        onSidesChange={this.handleSidesChange}
                        onTypesChange={this.handleTypesChange}
                        onExcludeModifiedChange={this.handleExcludeModifiedChange}
                    />
                    <div className={`${c}-export-buttons`}>
                        <Button size="sm" color="secondary" outline onClick={this.handleExport}>
                            <FiDownload /> Export CSV
                        </Button>
                    </div>
                </div>
                <div className={`${c}-body`}>
                    <div className={`${c}-chart-area`}>
                        <AudiogramChart
                            series={series}
                            width={chartWidth}
                            height={chartHeight}
                        />
                    </div>
                    <div className={`${c}-sidebar`}>
                        <CohortComparePanel
                            savedQueries={savedQueries}
                            comparisons={compEntries}
                            showCurrentCohort={showCurrentCohort}
                            onToggleCurrentCohort={this.handleToggleCurrentCohort}
                            onAdd={this.handleAddComparison}
                            onRemove={this.handleRemoveComparison}
                        />
                    </div>
                </div>
            </div>
        );
    }

    private buildSeries = (): AudiogramSeries[] => {
        const { rows, selectedSides, selectedTypes, comparisons, showCurrentCohort, excludeModified } = this.state;

        const result: AudiogramSeries[] = [];

        if (showCurrentCohort) {
            result.push({
                id: 'current',
                label: 'Current Cohort',
                color: CURRENT_COLOR,
                data: aggregateAudiogramData(rows, selectedSides, selectedTypes, excludeModified),
                pta: computePtaSummary(rows, selectedSides, selectedTypes, excludeModified)
            });
        }

        for (const comp of comparisons) {
            if (comp.loading || comp.error || comp.rows.length === 0) continue;
            result.push({
                id: comp.queryId,
                label: comp.label,
                color: comp.color,
                data: aggregateAudiogramData(comp.rows, selectedSides, selectedTypes, excludeModified),
                pta: computePtaSummary(comp.rows, selectedSides, selectedTypes, excludeModified)
            });
        }

        return result;
    };

    private getDimensions = () => {
        try {
            const dim = computeDimensions();
            return { width: dim.contentWidth, height: dim.height };
        } catch {
            return { width: 800, height: 600 };
        }
    };

    private handleResize = () => {
        const dim = this.getDimensions();
        this.setState({ width: dim.width, height: dim.height });
    };

    private loadData = async () => {
        const { appState, queryId } = this.props;
        this.prevQueryId = queryId;
        this.setState({ loading: true, error: null });

        try {
            const datasetId = findAudiogramDatasetId(appState);
            if (!datasetId) {
                this.setState({ loading: false, error: 'Audiogram dataset not found. Please ensure the "Audiogram Thresholds" dataset is configured.' });
                return;
            }

            const dto: PatientListDatasetDTO = await fetchAudiogramData(appState, queryId, datasetId);
            const rows = parseAudiogramData(dto);
            const filterOptions = extractFilterOptions(rows);

            const selectedSides = filterOptions.sides.length > 0 ? [...filterOptions.sides] : [];
            const selectedTypes = filterOptions.types.length > 0 ? [filterOptions.types[0]] : [];

            this.setState({
                loading: false,
                rows,
                filterOptions,
                selectedSides,
                selectedTypes
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            this.setState({
                loading: false,
                error: `Failed to load audiogram data: ${msg}`
            });
        }
    };

    private handleSidesChange = (sides: string[]) => {
        this.setState({ selectedSides: sides });
    };

    private handleTypesChange = (types: string[]) => {
        this.setState({ selectedTypes: types });
    };

    private handleExcludeModifiedChange = (exclude: boolean) => {
        this.setState({ excludeModified: exclude });
    };

    private handleAddComparison = async (queryId: string, label: string) => {
        const { appState } = this.props;
        const { comparisons } = this.state;

        const colorIdx = comparisons.length % COMPARISON_COLORS.length;
        const color = COMPARISON_COLORS[colorIdx];

        const newComp: ComparisonState = {
            queryId, label, color,
            loading: true, error: null, rows: []
        };

        this.setState({ comparisons: [...comparisons, newComp] });

        try {
            const datasetId = findAudiogramDatasetId(appState);
            if (!datasetId) throw new Error('Audiogram dataset not configured');

            const dto: PatientListDatasetDTO = await fetchAudiogramData(appState, queryId, datasetId);
            const rows = parseAudiogramData(dto);

            this.setState(prev => ({
                comparisons: prev.comparisons.map(c =>
                    c.queryId === queryId
                        ? { ...c, loading: false, rows }
                        : c
                )
            }));
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            this.setState(prev => ({
                comparisons: prev.comparisons.map(c =>
                    c.queryId === queryId
                        ? { ...c, loading: false, error: msg }
                        : c
                )
            }));
        }
    };

    private handleToggleCurrentCohort = () => {
        this.setState(prev => ({ showCurrentCohort: !prev.showCurrentCohort }));
    };

    private handleRemoveComparison = (queryId: string) => {
        this.setState(prev => ({
            comparisons: prev.comparisons.filter(c => c.queryId !== queryId)
        }));
    };

    private handleExport = () => {
        const { rows, selectedSides, selectedTypes, comparisons, showCurrentCohort, excludeModified } = this.state;

        const entries: Array<{ label: string; rows: AudiogramRow[] }> = [];

        if (showCurrentCohort) {
            entries.push({ label: 'Current Cohort', rows: getFilteredRows(rows, selectedSides, selectedTypes, excludeModified) });
        }

        for (const comp of comparisons) {
            if (!comp.loading && !comp.error && comp.rows.length > 0) {
                entries.push({
                    label: comp.label,
                    rows: getFilteredRows(comp.rows, selectedSides, selectedTypes, excludeModified)
                });
            }
        }

        exportMultiSeriesCsv(entries, 'audiogram_export.csv');
    };
}

const mapStateToProps = (state: AppState): StateProps => {
    let queryId = '';
    state.responders.forEach((nr) => {
        const nc = state.cohort.networkCohorts.get(nr.id);
        if (nc && nc.count.state === CohortStateType.LOADED && nc.count.queryId) {
            queryId = nc.count.queryId;
        }
    });

    const savedQueries: SavedQueryRef[] = [];
    state.queries.saved.forEach((q) => savedQueries.push(q));

    return {
        queryId,
        cohortLoaded: state.cohort.count.state === CohortStateType.LOADED,
        appState: state,
        savedQueries
    };
};

export default connect<StateProps, DispatchProps, OwnProps, AppState>
    (mapStateToProps, {})(Audiometry);
