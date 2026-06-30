import React from 'react';
import LibraryTabBase from './LibraryTabBase';
import LibraryLocationsHeader from './LibraryLocationsHeader';

/**
 * Library → Locations tab.
 * Renders a rich stats header (stat cards + bar chart + geo SVG scatter) above
 * the shared table. LibraryTabBase reads `entityType.supports_extra_fields` to
 * show the Lat/Lng column and inline editor.
 */
const LibraryLocationsTab = ({ entityType }) => (
    <>
        <LibraryLocationsHeader entityType={entityType} />
        <LibraryTabBase entityType={entityType} />
    </>
);

export default LibraryLocationsTab;
