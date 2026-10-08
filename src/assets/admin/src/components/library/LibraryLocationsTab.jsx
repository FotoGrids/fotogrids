import React, { useReducer } from 'react';
import LibraryTabBase from './LibraryTabBase';
import LibraryLocationsHeader from './LibraryLocationsHeader';

/**
 * Library → Locations tab.
 * Renders a rich stats header (stat cards + bar chart + geo SVG scatter) above
 * the shared table. LibraryTabBase reads `entityType.supports_extra_fields` to
 * show the Lat/Lng column and inline editor.
 */
const LibraryLocationsTab = ({ entityType }) => {
	const [statsVersion, bumpStats] = useReducer((n) => n + 1, 0);

	return (
		<>
			<LibraryLocationsHeader
				entityType={entityType}
				refreshKey={statsVersion}
			/>
			<LibraryTabBase entityType={entityType} onChange={bumpStats} />
		</>
	);
};

export default LibraryLocationsTab;
