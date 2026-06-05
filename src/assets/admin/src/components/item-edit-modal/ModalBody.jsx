import React, { useState, useEffect } from 'react';
import TabDetails from './tabs/TabDetails';
import TabTags from './tabs/TabTags';
import TabPeople from './tabs/TabPeople';
import TabLocation from './tabs/TabLocation';
import TabInteractions from './tabs/TabInteractions';
import TabEXIF from './tabs/TabEXIF';
import TabSEO from './tabs/TabSEO';
import Icon from '../shared/Icon';
import { Modal } from '../shared/Modal';

export const ItemPreviewPane = ({ itemData, loading, formData, strings }) => {
    const hasError = !loading && !itemData;
    const [showFileInfoItems, setShowFileInfoItems] = useState([]);

    useEffect(() => {
        if (!loading && itemData && !hasError) {
            const items = [];
            if (itemData.filename) items.push('filename');
            if (itemData.filesize) items.push('filesize');
            if (itemData.width && itemData.height) items.push('dimensions');
            if (itemData.mime_type) items.push('mime_type');

            items.forEach((item, index) => {
                setTimeout(() => {
                    setShowFileInfoItems(prev => [...prev, item]);
                }, index * 100);
            });
        } else {
            setShowFileInfoItems([]);
        }
    }, [loading, itemData, hasError]);

    return (
        <>
            <div className={`fotogrids-item-preview ${loading ? 'fotogrids-item-preview--skeleton' : ''} ${hasError ? 'fotogrids-item-preview--error' : ''}`}>
                {loading ? (
                    <div className="fotogrids-item-preview__skeleton"></div>
                ) : hasError ? (
                    <div className="fotogrids-item-preview__error">
                        <Icon name="x_circle" className="fotogrids-item-preview__error-icon" />
                    </div>
                ) : itemData?.thumbnail_url ? (
                    <img src={itemData.thumbnail_url} alt={formData?.alt || ''} />
                ) : null}
            </div>
            {loading ? null : hasError ? (
                <div className="fotogrids-file-info fotogrids-file-info--error">
                    <div className="fotogrids-file-info__error-message">
                        {strings.failedLoading}
                    </div>
                </div>
            ) : itemData ? (
                <div className="fotogrids-file-info">
                    {showFileInfoItems.includes('filename') && (
                        <div className="fotogrids-file-info__item fotogrids-file-info__item--animate">
                            <span className="fotogrids-file-info__label">{strings.filename}:</span>
                            <span className="fotogrids-file-info__value">{itemData.filename || strings.notAvailable}</span>
                        </div>
                    )}
                    {showFileInfoItems.includes('filesize') && itemData.filesize && (
                        <div className="fotogrids-file-info__item fotogrids-file-info__item--animate">
                            <span className="fotogrids-file-info__label">{strings.fileSize}:</span>
                            <span className="fotogrids-file-info__value">{itemData.filesize}</span>
                        </div>
                    )}
                    {showFileInfoItems.includes('dimensions') && (itemData.width && itemData.height) && (
                        <div className="fotogrids-file-info__item fotogrids-file-info__item--animate">
                            <span className="fotogrids-file-info__label">{strings.dimensions}:</span>
                            <span className="fotogrids-file-info__value">{itemData.width} × {itemData.height}</span>
                        </div>
                    )}
                    {showFileInfoItems.includes('mime_type') && itemData.mime_type && (
                        <div className="fotogrids-file-info__item fotogrids-file-info__item--animate">
                            <span className="fotogrids-file-info__label">{strings.fileType}:</span>
                            <span className="fotogrids-file-info__value">{itemData.mime_type}</span>
                        </div>
                    )}
                </div>
            ) : null}
        </>
    );
};

const tabConfig = (strings) => [
    { id: 'details',      label: strings.details },
    { id: 'tags',         label: strings.tags },
    { id: 'people',       label: strings.people },
    { id: 'location',     label: strings.location },
    { id: 'interactions', label: strings.interactions },
    { id: 'exif',         label: strings.exif },
    { id: 'seo',          label: (
        <>
            {strings.seo} <span className="fotogrids-pro-badge">{strings.pro}</span>
        </>
    ) },
];

export const ItemEditTabs = ({
    itemData,
    loading,
    formData,
    activeTab,
    setActiveTab,
    handleInputChange,
    metadata,
    availableMetadata,
    metadataInput,
    setMetadataInput,
    addMetadataItem,
    removeMetadataItem,
    selectExistingMetadata,
    strings,
}) => {
    const hasError = !loading && !itemData;
    const isDisabled = loading || hasError;

    return (
        <>
            <Modal.Tabs
                tabs={tabConfig(strings)}
                activeId={activeTab}
                onChange={setActiveTab}
                disabled={isDisabled}
            />

            <Modal.TabsPanel id="details" activeId={activeTab}>
                <TabDetails
                    formData={formData}
                    handleInputChange={handleInputChange}
                    strings={strings}
                    disabled={isDisabled}
                />
            </Modal.TabsPanel>

            <Modal.TabsPanel id="tags" activeId={activeTab}>
                <TabTags
                    metadata={metadata}
                    availableMetadata={availableMetadata}
                    metadataInput={metadataInput}
                    setMetadataInput={setMetadataInput}
                    addMetadataItem={addMetadataItem}
                    removeMetadataItem={removeMetadataItem}
                    selectExistingMetadata={selectExistingMetadata}
                    disabled={isDisabled}
                    strings={strings}
                />
            </Modal.TabsPanel>

            <Modal.TabsPanel id="people" activeId={activeTab}>
                <TabPeople
                    metadata={metadata}
                    availableMetadata={availableMetadata}
                    metadataInput={metadataInput}
                    setMetadataInput={setMetadataInput}
                    addMetadataItem={addMetadataItem}
                    removeMetadataItem={removeMetadataItem}
                    selectExistingMetadata={selectExistingMetadata}
                    disabled={isDisabled}
                    strings={strings}
                />
            </Modal.TabsPanel>

            <Modal.TabsPanel id="location" activeId={activeTab}>
                <TabLocation
                    metadata={metadata}
                    availableMetadata={availableMetadata}
                    metadataInput={metadataInput}
                    setMetadataInput={setMetadataInput}
                    addMetadataItem={addMetadataItem}
                    removeMetadataItem={removeMetadataItem}
                    selectExistingMetadata={selectExistingMetadata}
                    disabled={isDisabled}
                    strings={strings}
                    exifData={formData.exif}
                />
            </Modal.TabsPanel>

            <Modal.TabsPanel id="interactions" activeId={activeTab}>
                <TabInteractions
                    formData={formData}
                    handleInputChange={handleInputChange}
                    disabled={isDisabled}
                />
            </Modal.TabsPanel>

            <Modal.TabsPanel id="exif" activeId={activeTab}>
                <TabEXIF
                    formData={formData}
                    handleInputChange={handleInputChange}
                    strings={strings}
                    disabled={isDisabled}
                />
            </Modal.TabsPanel>

            <Modal.TabsPanel id="seo" activeId={activeTab}>
                <TabSEO
                    formData={formData}
                    handleInputChange={handleInputChange}
                    disabled={isDisabled}
                    strings={strings}
                />
            </Modal.TabsPanel>
        </>
    );
};
