import React from 'react';
import LibraryTabBase from './LibraryTabBase';
import LibraryPeopleHeader from './LibraryPeopleHeader';

/**
 * Library → People tab.
 * Renders a rich stats header (stat cards + charts + optional Pro nudge) above
 * the shared table/search/bulk-actions via LibraryTabBase. The inline-rename
 * form picks up the optional `details` field automatically because
 * LibraryTabBase branches on entityType.type === 'person'.
 */
const LibraryPeopleTab = ({ entityType }) => (
    <>
        <LibraryPeopleHeader entityType={entityType} />
        <LibraryTabBase entityType={entityType} />
    </>
);

export default LibraryPeopleTab;
