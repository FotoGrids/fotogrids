import React from 'react';
import MetadataTab from './MetadataTab';

const TabLocation = ({
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
            metadataKey="locations"
            inputKey="location"
            placeholder={strings.addLocationPlaceholder || ''}
            icon={window.FotoGridsIcons?.location || ''}
            isSingleItem={true}
            showProNotice={true}
            proNoticeContent={{
                badge: strings.pro,
                title: strings.locationSmartSuggestions,
                description: strings.locationSmartSuggestionsDesc,
                upgradeText: strings.upgradeToPro
            }}
        />
    );
};

export default TabLocation;
