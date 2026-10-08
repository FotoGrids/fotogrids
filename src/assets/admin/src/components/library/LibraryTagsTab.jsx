import React, { useReducer } from 'react';
import LibraryTabBase from './LibraryTabBase';
import LibraryTagsHeader from './LibraryTagsHeader';

/**
 * Library → Tags tab.
 * Renders a rich stats header (stat cards + charts) followed by the shared
 * table/search/bulk-actions via LibraryTabBase.
 */
const LibraryTagsTab = ({ entityType }) => {
	const [statsVersion, bumpStats] = useReducer((n) => n + 1, 0);

	return (
		<>
			<LibraryTagsHeader
				entityType={entityType}
				refreshKey={statsVersion}
			/>
			<LibraryTabBase entityType={entityType} onChange={bumpStats} />
		</>
	);
};

export default LibraryTagsTab;
