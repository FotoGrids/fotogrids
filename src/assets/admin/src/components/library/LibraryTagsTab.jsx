import React from 'react';
import LibraryTabBase from './LibraryTabBase';

/**
 * Library → Tags tab. Thin wrapper over LibraryTabBase so the shared logic
 * (search, pagination, bulk actions, merge, recalc) stays in one place.
 */
const LibraryTagsTab = ({ entityType }) => <LibraryTabBase entityType={entityType} />;

export default LibraryTagsTab;
