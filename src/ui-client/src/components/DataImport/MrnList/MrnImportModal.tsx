/* Copyright (c) 2022, UW Medicine Research IT, University of Washington
 * Developed by Nic Dobbins and Cliff Spital, CRIO Sean Mooney
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import React from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';
import ImportState from '../../../models/state/Import';
import { toggleImportMrnModal, importMrnList, deleteMrnImport } from '../../../actions/dataImport';
import { ImportMetadata, ImportType, MrnImportStructure } from '../../../models/dataImport/ImportMetadata';
import './MrnImportModal.css';

interface Props {
    data: ImportState;
    dispatch: any;
    isIdentified: boolean;
    show: boolean;
}

type InputMode = 'mrn' | 'personId';

interface State {
    identifiers: string;
    mode: InputMode;
    name: string;
    result: { changed: number; unmapped: string[] } | null;
    isLoading: boolean;
    isErrored: boolean;
    pendingDelete: ImportMetadata | null;
}

export default class MrnImportModal extends React.PureComponent<Props, State> {
    private className = 'import-mrn';

    constructor(props: Props) {
        super(props);
        this.state = {
            identifiers: '',
            mode: props.isIdentified ? 'mrn' : 'personId',
            name: '',
            result: null,
            isLoading: false,
            isErrored: false,
            pendingDelete: null
        };
    }

    public render() {
        const c = this.className;
        const classes = [ c, 'leaf-modal' ];
        const { show } = this.props;
        const { isLoading, isErrored, result } = this.state;

        return (
            <Modal isOpen={show} className={classes.join(' ')} keyboard={true}>

                {/* Header */}
                <ModalHeader>
                    Import Patient List
                    <span className={`${c}-close`} onClick={this.handleCloseClick}>✖</span>
                </ModalHeader>

                {/* Body */}
                <ModalBody>
                    <div className={`${c}-container`}>
                        {this.getMainContent()}
                        {!isLoading && !isErrored && this.getExistingListsContent()}
                    </div>
                </ModalBody>

                {/* Footer */}
                {!isLoading &&
                <ModalFooter>
                    {result
                        ? <Button className="leaf-button leaf-button-primary" onClick={this.handleCloseClick}>
                            Done
                          </Button>
                        : <>
                            <Button className="leaf-button leaf-button-secondary" onClick={this.handleCloseClick}>
                                Cancel
                            </Button>
                            <Button
                                className="leaf-button leaf-button-primary"
                                onClick={this.handleSubmitClick}
                                disabled={isLoading || !this.state.identifiers.trim()}
                            >
                                Import
                            </Button>
                          </>
                    }
                </ModalFooter>
                }
            </Modal>
        );
    }

    private getMainContent = () => {
        const c = this.className;
        const { isIdentified } = this.props;
        const { identifiers, mode, name, result, isLoading, isErrored } = this.state;

        if (isErrored) {
            return (
                <div className={`${c}-error`}>
                    <p>Whoops! Leaf encountered an unexpected error while importing the patient list.</p>
                    <p>Please contact your Leaf administrator if the problem persists.</p>
                </div>
            );
        }

        if (isLoading) {
            return <p>Importing patient list, please wait...</p>;
        }

        if (result) {
            const hasUnmapped = result.unmapped && result.unmapped.length > 0;
            return (
                <div className={`${c}-result ${hasUnmapped ? 'warning' : 'success'}`}>
                    <p>
                        Loaded <strong>{result.changed.toLocaleString()}</strong> patient{result.changed !== 1 ? 's' : ''}.
                        {hasUnmapped && <> {result.unmapped.length.toLocaleString()} identifier{result.unmapped.length !== 1 ? 's' : ''} could not be resolved.</>}
                    </p>
                    {hasUnmapped &&
                        <div className={`${c}-result-unmapped`}>
                            {result.unmapped.map((u, i) => <div key={i}>{u}</div>)}
                        </div>
                    }
                </div>
            );
        }

        return (
            <>
                {/* Mode selector */}
                <div className={`${c}-mode`}>
                    <label className={!isIdentified ? `${c}-mode-disabled` : ''} title={!isIdentified ? 'MRN import requires PHI access' : ''}>
                        <input
                            type="radio"
                            value="mrn"
                            checked={mode === 'mrn'}
                            disabled={!isIdentified}
                            onChange={this.handleModeChange}
                        />
                        MRN
                    </label>
                    <label>
                        <input
                            type="radio"
                            value="personId"
                            checked={mode === 'personId'}
                            onChange={this.handleModeChange}
                        />
                        Person ID
                    </label>
                </div>

                {/* Optional name */}
                <label className={`${c}-name-label`}>List name (optional)</label>
                <input
                    className={`${c}-name-input`}
                    type="text"
                    placeholder={`Patient List ${new Date().toLocaleDateString()}`}
                    value={name}
                    onChange={this.handleNameChange}
                />

                {/* Identifiers */}
                <label className={`${c}-ids-label`}>
                    Paste one {mode === 'mrn' ? 'MRN' : 'Person ID'} per line
                </label>
                <textarea
                    className={`${c}-textarea`}
                    value={identifiers}
                    onChange={this.handleIdentifiersChange}
                    placeholder={mode === 'mrn' ? '1234567\n2345678\n3456789' : '12345\n23456\n34567'}
                />
            </>
        );
    }

    private getExistingListsContent = () => {
        const c = this.className;
        const { data } = this.props;
        const { pendingDelete } = this.state;

        const mrnImports = [ ...data.imports.values() ].filter(i => i.type === ImportType.MRN);
        if (mrnImports.length === 0) return null;

        return (
            <div className={`${c}-existing`}>
                <div className={`${c}-existing-header`}>Your Patient Lists</div>
                {mrnImports.map(meta => {
                    const struct = meta.structure as MrnImportStructure;
                    const isPending = pendingDelete?.id === meta.id;
                    return (
                        <div key={meta.id} className={`${c}-existing-row`}>
                            <span className={`${c}-existing-name`}>{struct.name}</span>
                            {isPending
                                ? <span className={`${c}-existing-confirm`}>
                                    Delete?&nbsp;
                                    <span className={`${c}-existing-confirm-yes`} onClick={() => this.handleDeleteConfirm(meta)}>Yes</span>
                                    &nbsp;/&nbsp;
                                    <span className={`${c}-existing-confirm-no`} onClick={() => this.setState({ pendingDelete: null })}>No</span>
                                  </span>
                                : <span className={`${c}-existing-delete`} onClick={() => this.setState({ pendingDelete: meta })} title="Delete list">✖</span>
                            }
                        </div>
                    );
                })}
            </div>
        );
    }

    private handleDeleteConfirm = async (meta: ImportMetadata) => {
        const { dispatch } = this.props;
        this.setState({ pendingDelete: null });
        await dispatch(deleteMrnImport(meta));
    }

    private handleModeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ mode: e.target.value as InputMode });
    }

    private handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ name: e.target.value });
    }

    private handleIdentifiersChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        this.setState({ identifiers: e.target.value });
    }

    private handleSubmitClick = async () => {
        const { dispatch } = this.props;
        const { identifiers, mode, name } = this.state;

        const parsed = identifiers
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const deduped = [ ...new Set(parsed) ];
        if (deduped.length === 0) { return; }

        const resolvedName = name.trim() || `Patient List ${new Date().toLocaleDateString()}`;

        this.setState({ isLoading: true, isErrored: false });

        try {
            const result = await dispatch(importMrnList(deduped, mode, resolvedName));
            this.setState({ isLoading: false, result });
        } catch (err) {
            this.setState({ isLoading: false, isErrored: true });
        }
    }

    private handleCloseClick = () => {
        const { dispatch } = this.props;
        this.setState({
            identifiers: '',
            mode: 'mrn',
            name: '',
            result: null,
            isLoading: false,
            isErrored: false,
            pendingDelete: null
        });
        dispatch(toggleImportMrnModal());
    }
}
