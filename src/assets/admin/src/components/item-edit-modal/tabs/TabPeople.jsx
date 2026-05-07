import React from 'react';
import MetadataTab from './MetadataTab';

const TabPeople = ({
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
            metadataKey="people"
            inputKey="people"
            placeholder={strings.addPeoplePlaceholder || ''}
            icon={window.FotoGridsIcons?.people || ''}
            showProNotice={true}
            proNoticeContent={{
                badge: strings.pro,
                title: strings.facialRecognition,
                description: strings.facialRecognitionDesc,
                upgradeText: strings.upgradeToPro
            }}
        />
    );
};

export default TabPeople;
