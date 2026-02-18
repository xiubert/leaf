/*
 * PAC 20260218
 */

import React from 'react';
import { connect } from 'react-redux';
import { AppState } from '../../models/state/AppState';
import { CohortStateType } from '../../models/state/CohortState';
import { PatientListDatasetDTO } from '../../models/patientList/Dataset';
import { findAudiogramDatasetId, fetchAudiogramData } from '../../services/audiometryApi';
import {
    AudiogramRow, AudiogramSummaryPoint, AudiogramFilterOptions,
    parseAudiogramData, extractFilterOptions, aggregateAudiogramData,
    getFilteredRows, exportAudiogramCsv
} from '../../utils/audiogramData';
import AudiogramChart from '../../components/Audiometry/AudiogramChart';
import AudiogramFilters from '../../components/Audiometry/AudiogramFilters';
import { Button } from 'reactstrap';
import { FiDownload } from 'react-icons/fi';
import LoaderIcon from '../../components/Other/LoaderIcon/LoaderIcon';
import computeDimensions from '../../utils/computeDimensions';
import './Audiometry.css';

interface OwnProps {}
interface StateProps {
    queryId: string;
    cohortLoaded: boolean;
    appState: AppState;
}
interface DispatchProps {}
type Props = StateProps & OwnProps & DispatchProps;

interface State {
    loading: boolean;
    error: string | null;
    rows: AudiogramRow[];
    filterOptions: AudiogramFilterOptions;
    selectedSides: string[];
    selectedTypes: string[];
    summaryData: AudiogramSummaryPoint[];
    width: number;
    height: number;
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
            summaryData: [],
            width: dim.width,
            height: dim.height
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
        const { cohortLoaded, queryId } = this.props;
        const { loading, error, filterOptions, selectedSides, selectedTypes, summaryData, width, height } = this.state;
        const c = 'audiometry';

        console.log('[Audiometry] render — cohortLoaded:', cohortLoaded, 'queryId:', queryId, 'prevQueryId:', this.prevQueryId, 'loading:', loading, 'error:', error, 'sides:', filterOptions.sides);

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
        const chartHeight = Math.max(height - 120, 300);

        return (
            <div className={`${c}-container scrollable-offset-by-header`}>
                <div className={`${c}-toolbar`}>
                    <AudiogramFilters
                        availableSides={filterOptions.sides}
                        availableTypes={filterOptions.types}
                        selectedSides={selectedSides}
                        selectedTypes={selectedTypes}
                        onSidesChange={this.handleSidesChange}
                        onTypesChange={this.handleTypesChange}
                    />
                    <div className={`${c}-export-buttons`}>
                        <Button size="sm" color="secondary" outline onClick={this.handleExportPlot}>
                            <FiDownload /> Export Plot Data
                        </Button>
                        <Button size="sm" color="secondary" outline onClick={this.handleExportAll}>
                            <FiDownload /> Export All Readings
                        </Button>
                    </div>
                </div>
                <AudiogramChart
                    data={summaryData}
                    width={chartWidth}
                    height={chartHeight}
                />
            </div>
        );
    }

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

        console.log('[Audiometry] loadData called. queryId:', queryId);
        console.log('[Audiometry] datasets.all size:', appState.datasets.all.size);
        console.log('[Audiometry] dataset names:', Array.from(appState.datasets.all.values()).map(d => d.name));

        try {
            const datasetId = findAudiogramDatasetId(appState);
            console.log('[Audiometry] found datasetId:', datasetId);
            if (!datasetId) {
                this.setState({ loading: false, error: 'Audiogram dataset not found. Please ensure the "Audiogram Thresholds" dataset is configured.' });
                return;
            }

            const dto: PatientListDatasetDTO = await fetchAudiogramData(appState, queryId, datasetId);
            const rows = parseAudiogramData(dto);
            const filterOptions = extractFilterOptions(rows);

            // Default selections: all sides and first type (or all)
            const selectedSides = filterOptions.sides.length > 0 ? [...filterOptions.sides] : [];
            const selectedTypes = filterOptions.types.length > 0 ? [filterOptions.types[0]] : [];

            const summaryData = aggregateAudiogramData(rows, selectedSides, selectedTypes);

            this.setState({
                loading: false,
                rows,
                filterOptions,
                selectedSides,
                selectedTypes,
                summaryData
            });
        } catch (err) {
            console.error('Failed to load audiogram data:', err);
            const msg = err instanceof Error ? err.message : 'Unknown error';
            this.setState({
                loading: false,
                error: `Failed to load audiogram data: ${msg}`
            });
        }
    };

    private handleSidesChange = (sides: string[]) => {
        const summaryData = aggregateAudiogramData(this.state.rows, sides, this.state.selectedTypes);
        this.setState({ selectedSides: sides, summaryData });
    };

    private handleTypesChange = (types: string[]) => {
        const summaryData = aggregateAudiogramData(this.state.rows, this.state.selectedSides, types);
        this.setState({ selectedTypes: types, summaryData });
    };

    private handleExportPlot = () => {
        const { rows, selectedSides, selectedTypes } = this.state;
        const filtered = getFilteredRows(rows, selectedSides, selectedTypes);
        exportAudiogramCsv(filtered, 'audiogram_plot_data.csv');
    };

    private handleExportAll = () => {
        const { rows, selectedSides, selectedTypes } = this.state;
        const filtered = rows.filter(r =>
            selectedSides.includes(r.side) && selectedTypes.includes(r.type)
        );
        exportAudiogramCsv(filtered, 'audiogram_all_readings.csv');
    };
}

const mapStateToProps = (state: AppState): StateProps => {
    // queryId lives on individual network cohort entries, not the top-level count
    let queryId = '';
    state.responders.forEach((nr) => {
        const nc = state.cohort.networkCohorts.get(nr.id);
        if (nc && nc.count.state === CohortStateType.LOADED && nc.count.queryId) {
            queryId = nc.count.queryId;
        }
    });
    return {
        queryId,
        cohortLoaded: state.cohort.count.state === CohortStateType.LOADED,
        appState: state
    };
};

export default connect<StateProps, DispatchProps, OwnProps, AppState>
    (mapStateToProps, {})(Audiometry);
