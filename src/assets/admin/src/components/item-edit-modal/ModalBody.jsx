import React, { useState, useEffect } from 'react';
import TabDetails from './tabs/TabDetails';
import TabTags from './tabs/TabTags';
import TabPeople from './tabs/TabPeople';
import TabLocation from './tabs/TabLocation';
import TabInteractions from './tabs/TabInteractions';
import TabEXIF from './tabs/TabEXIF';
import TabSEO from './tabs/TabSEO';
import Icon from '../shared/Icon';

const ModalBody = ({
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
    strings
}) => {
    const hasError = !loading && !itemData;
    const isDisabled = loading || hasError;
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
		<div className="fotogrids-modal__layout fotogrids-modal__layout-double">
			{/* Left side - Item preview */}
			<div className="fotogrids-modal__body__sidebar">
				<div className={`fotogrids-item-preview ${loading ? 'fotogrids-item-preview--skeleton' : ''} ${hasError ? 'fotogrids-item-preview--error' : ''}`}>
					{loading ? (
						<div className="fotogrids-item-preview__skeleton"></div>
					) : hasError ? (
						<div className="fotogrids-item-preview__error">
							<Icon name="x_circle" className="fotogrids-item-preview__error-icon" />
						</div>
					) : itemData?.medium_url ? (
						<img src={itemData.medium_url} alt={formData?.alt || ''} />
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
			</div>

			{/* Right side - Tabs and content */}
			<div className="fotogrids-modal__body__main">
				<div className={`fotogrids-modal-tabs ${isDisabled ? 'fotogrids-modal-tabs--disabled' : ''}`}>
					<button
						type="button"
						className={`fotogrids-tab-button ${activeTab === 'details' ? 'fg-is-active' : ''}`}
						onClick={() => !isDisabled && setActiveTab('details')}
						disabled={isDisabled}
					>
						{strings.details}
					</button>
					<button
						type="button"
						className={`fotogrids-tab-button ${activeTab === 'tags' ? 'fg-is-active' : ''}`}
						onClick={() => !isDisabled && setActiveTab('tags')}
						disabled={isDisabled}
					>
						{strings.tags}
					</button>
					<button
						type="button"
						className={`fotogrids-tab-button ${activeTab === 'people' ? 'fg-is-active' : ''}`}
						onClick={() => !isDisabled && setActiveTab('people')}
						disabled={isDisabled}
					>
						{strings.people}
					</button>
					<button
						type="button"
						className={`fotogrids-tab-button ${activeTab === 'location' ? 'fg-is-active' : ''}`}
						onClick={() => !isDisabled && setActiveTab('location')}
						disabled={isDisabled}
					>
						{strings.location}
					</button>
					<button
						type="button"
						className={`fotogrids-tab-button ${activeTab === 'interactions' ? 'fg-is-active' : ''}`}
						onClick={() => !isDisabled && setActiveTab('interactions')}
						disabled={isDisabled}
					>
						{strings.interactions}
					</button>
					<button
						type="button"
						className={`fotogrids-tab-button ${activeTab === 'exif' ? 'fg-is-active' : ''}`}
						onClick={() => !isDisabled && setActiveTab('exif')}
						disabled={isDisabled}
					>
						{strings.exif}
					</button>
					<button
						type="button"
						className={`fotogrids-tab-button ${activeTab === 'seo' ? 'fg-is-active' : ''}`}
						onClick={() => !isDisabled && setActiveTab('seo')}
						disabled={isDisabled}
					>
						{strings.seo} <div className="fotogrids-pro-badge">{strings.pro}</div>
					</button>
				</div>

				<div className="fotogrids-tab-content">
					{activeTab === 'details' && (
						<TabDetails
							formData={formData}
							handleInputChange={handleInputChange}
							strings={strings}
							disabled={isDisabled}
						/>
					)}

					{activeTab === 'tags' && (
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
					)}

					{activeTab === 'people' && (
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
					)}

					{activeTab === 'location' && (
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
						/>
					)}

					{activeTab === 'interactions' && (
						<TabInteractions
							formData={formData}
							handleInputChange={handleInputChange}
							disabled={isDisabled}
						/>
					)}

					{activeTab === 'exif' && (
						<TabEXIF
							formData={formData}
							handleInputChange={handleInputChange}
							strings={strings}
							disabled={isDisabled}
						/>
					)}

					{activeTab === 'seo' && (
						<TabSEO
							formData={formData}
							handleInputChange={handleInputChange}
							disabled={isDisabled}
							strings={strings}
						/>
					)}
				</div>
			</div>
		</div>
    );
};

export default ModalBody;
