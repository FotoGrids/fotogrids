import React from 'react';
import LibraryTabBase from './LibraryTabBase';
import LibraryTagsHeader from './LibraryTagsHeader';

/**
 * Library → Tags tab.
 * Renders a rich stats header (stat cards + charts) followed by the shared
 * table/search/bulk-actions via LibraryTabBase.
 */
const LibraryTagsTab = ({ entityType }) => (
    <>
        <LibraryTagsHeader entityType={entityType} />
        <LibraryTabBase entityType={entityType} />
    </>
);

export default LibraryTagsTab;
