import React from 'react';
import MetadataTab from './MetadataTab';

const TabTags = ({
    metadata,
    availableMetadata,
    metadataInput,
    setMetadataInput,
    addMetadataItem,
    removeMetadataItem,
    selectExistingMetadata,
    disabled = false,
    strings = {}
}) => {
    return (
        <MetadataTab
            metadata={metadata}
            availableMetadata={availableMetadata}
            metadataInput={metadataInput}
            setMetadataInput={setMetadataInput}
            addMetadataItem={addMetadataItem}
            removeMetadataItem={removeMetadataItem}
            selectExistingMetadata={selectExistingMetadata}
            disabled={disabled}
            strings={strings}
            metadataKey="tags"
            placeholder={strings.addTagsPlaceholder || ''}
            iconName="tag"
            itemClassName="fotogrids-metadata-item fotogrids-tag"
        />
    );
};

export default TabTags;
