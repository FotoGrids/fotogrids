import React from 'react';
import LibraryTabBase from './LibraryTabBase';

/**
 * Library → People tab. The inline-rename form picks up the optional
 * `details` field automatically because LibraryTabBase branches on
 * entityType.type === 'person'.
 */
const LibraryPeopleTab = ({ entityType }) => <LibraryTabBase entityType={entityType} />;

export default LibraryPeopleTab;
