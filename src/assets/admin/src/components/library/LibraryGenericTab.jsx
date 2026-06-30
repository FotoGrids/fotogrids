import React from 'react';
import LibraryTabBase from './LibraryTabBase';

/**
 * Fallback tab for entity types registered via the
 * `fotogrids/library/entity_types` filter that don't have a dedicated
 * tab component. The shared LibraryTabBase still handles them as long as
 * they expose the standard fields (id / name / slug / usage_count).
 */
const LibraryGenericTab = ({ entityType }) => <LibraryTabBase entityType={entityType} />;

export default LibraryGenericTab;
