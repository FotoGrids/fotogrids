import React from 'react';
import LibraryTabBase from './LibraryTabBase';

/**
 * Library → Locations tab. LibraryTabBase reads
 * `entityType.supports_extra_fields` to show the Lat/Lng column and inline
 * editor, so this tab is just a wrapper.
 */
const LibraryLocationsTab = ({ entityType }) => <LibraryTabBase entityType={entityType} />;

export default LibraryLocationsTab;
