/*
PAC 20260218
 */

import { AppState } from '../models/state/AppState';
import { PatientListDatasetDTO, PatientListDatasetShape } from '../models/patientList/Dataset';
import { HttpFactory } from './HttpFactory';

const AUDIOGRAM_DATASET_NAME = 'Audiogram Thresholds';
const WRS_DATASET_NAME       = 'Aud_WRS';

/**
 * Find the audiogram dataset ID from the already-loaded datasets in Redux state.
 */
export const findAudiogramDatasetId = (state: AppState): string | undefined => {
    for (const [id, ds] of state.datasets.all) {
        if (ds.name === AUDIOGRAM_DATASET_NAME) {
            return id;
        }
    }
    return undefined;
};

/**
 * Find the WRS dataset ID from the already-loaded datasets in Redux state.
 */
export const findWrsDatasetId = (state: AppState): string | undefined => {
    for (const [id, ds] of state.datasets.all) {
        if (ds.name === WRS_DATASET_NAME) {
            return id;
        }
    }
    return undefined;
};

/**
 * Fetch audiogram threshold data for the current cohort.
 */
export const fetchAudiogramData = async (state: AppState, queryId: string, datasetId: string): Promise<PatientListDatasetDTO> => {
    const { token } = state.session.context!;
    const http = HttpFactory.authenticated(token);
    const params = {
        datasetid: datasetId,
        shape: PatientListDatasetShape.Dynamic
    };
    const result = await http.get(`/api/cohort/${queryId}/dataset`, { params });
    return result.data as PatientListDatasetDTO;
};
