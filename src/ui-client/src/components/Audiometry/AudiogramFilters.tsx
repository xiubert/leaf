/*
 * PAC 20260218
 */

import React from 'react';
import { Button, ButtonGroup } from 'reactstrap';

interface Props {
    availableSides: string[];
    availableTypes: string[];
    selectedSides: string[];
    selectedTypes: string[];
    excludeModified: boolean;
    onSidesChange: (sides: string[]) => void;
    onTypesChange: (types: string[]) => void;
    onExcludeModifiedChange: (exclude: boolean) => void;
}

export default class AudiogramFilters extends React.PureComponent<Props> {

    public render() {
        const { availableSides, availableTypes, selectedSides, selectedTypes, excludeModified } = this.props;
        const c = 'audiogram-filters';

        return (
            <div className={c}>
                <div className={`${c}-group`}>
                    <span className={`${c}-label`}>Side:</span>
                    <ButtonGroup size="sm">
                        {availableSides.map(side => (
                            <Button
                                key={side}
                                color={selectedSides.includes(side) ? 'primary' : 'secondary'}
                                outline={!selectedSides.includes(side)}
                                onClick={this.handleSideToggle.bind(this, side)}
                            >
                                {this.getSideLabel(side)}
                            </Button>
                        ))}
                    </ButtonGroup>
                </div>

                <div className={`${c}-group`}>
                    <span className={`${c}-label`}>Type:</span>
                    <ButtonGroup size="sm">
                        {availableTypes.map(type => (
                            <Button
                                key={type}
                                color={selectedTypes.includes(type) ? 'primary' : 'secondary'}
                                outline={!selectedTypes.includes(type)}
                                onClick={this.handleTypeToggle.bind(this, type)}
                            >
                                {type}
                            </Button>
                        ))}
                    </ButtonGroup>
                </div>

                <div className={`${c}-group`}>
                    <label className={`${c}-check-label`}>
                        <input
                            type="checkbox"
                            checked={excludeModified}
                            onChange={e => this.props.onExcludeModifiedChange(e.target.checked)}
                        />
                        <span>Exclude modified readings</span>
                    </label>
                </div>
            </div>
        );
    }

    private getSideLabel = (side: string): string => {
        switch (side) {
            case 'L': return 'Left';
            case 'R': return 'Right';
            case 'B': return 'Both';
            default: return side;
        }
    };

    private handleSideToggle = (side: string) => {
        const { selectedSides, onSidesChange } = this.props;
        if (selectedSides.includes(side)) {
            if (selectedSides.length > 1) {
                onSidesChange(selectedSides.filter(s => s !== side));
            }
        } else {
            onSidesChange([...selectedSides, side]);
        }
    };

    private handleTypeToggle = (type: string) => {
        const { selectedTypes, onTypesChange } = this.props;
        if (selectedTypes.includes(type)) {
            if (selectedTypes.length > 1) {
                onTypesChange(selectedTypes.filter(t => t !== type));
            }
        } else {
            onTypesChange([...selectedTypes, type]);
        }
    };
}
