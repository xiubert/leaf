/* Copyright (c) 2022, UW Medicine Research IT, University of Washington
 * Developed by Nic Dobbins and Cliff Spital, CRIO Sean Mooney
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import React from 'react';

interface Props {}

export default class Audiometry extends React.PureComponent<Props> {
    public render() {
        return (
            <div id="audiometry-container">
                <h3>Audiometry</h3>
                <p>Audiometry views and analyses will appear here.</p>
            </div>
        );
    }
}
