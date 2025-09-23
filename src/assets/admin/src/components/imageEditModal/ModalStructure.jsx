import React from 'react';
import ModalBody from './ModalBody';
import SaveButton from './SaveButton';

const ModalStructure = ({
    imageId,
    imageData,
    loading,
    images,
    onClose,
    onNavigate,
    activeTab,
    setActiveTab,
    formData,
    handleInputChange,
    metadata,
    availableMetadata,
    metadataInput,
    setMetadataInput,
    addMetadataItem,
    removeMetadataItem,
    selectExistingMetadata,
    handleSave,
    saving,
    hasChanges,
    saveSuccess,
    strings
}) => {
    const currentIndex = images.findIndex(img => img.id === imageId);
    const hasMultipleImages = images.length > 1;

    return (
        <div id="fotogrids-image-edit-modal" className="fotogrids-modal">
            <div className="fotogrids-modal-content">
                <div className="fotogrids-modal-header">
                    <h3>{strings.editImage || 'Edit Image'}</h3>
                    <button type="button" className="fotogrids-modal-close" onClick={onClose}>
                        ×
                    </button>
                </div>

				<div className="fotogrids-modal-body">
					{loading ? (
						<div className="fotogrids-loading">
							{strings.loading || 'Loading...'}
						</div>
					) : !imageData ? (
						<div className="fotogrids-error">
							Failed loading image data
						</div>
					) : (
						<ModalBody
							imageData={imageData}
							formData={formData}
							activeTab={activeTab}
							setActiveTab={setActiveTab}
							handleInputChange={handleInputChange}
							metadata={metadata}
							availableMetadata={availableMetadata}
							metadataInput={metadataInput}
							setMetadataInput={setMetadataInput}
							addMetadataItem={addMetadataItem}
							removeMetadataItem={removeMetadataItem}
							selectExistingMetadata={selectExistingMetadata}
							strings={strings}
						/>
					)}
				</div>

                <div className="fotogrids-modal-footer">
                    {!loading && imageData && (
                        // <SaveButton
                        //     onClick={handleSave}
                        //     saving={saving}
                        //     hasChanges={hasChanges}
                        //     saveSuccess={saveSuccess}
                        //     strings={strings}
                        // />
						<button
							type="button"
							className="button"
							onClick={handleSave}
							disabled={!hasChanges || saving}
						>
							{strings.saveChanges || 'Save Changes'}
						</button>
                    )}
                    <button
                        type="button"
                        className="button"
                        onClick={onClose}
                    >
                        {strings.close || 'Close'}
                    </button>
                </div>
            </div>

            {/* Navigation arrows */}
            {hasMultipleImages && (
                <>
                    <button
                        type="button"
                        className="fotogrids-nav-arrow fotogrids-nav-prev"
                        onClick={() => onNavigate('prev')}
                        title={strings.prevImage || 'Previous image'}
                    >
                        <span className="fotogrids-icon" data-icon="chevron-left"></span>
                    </button>
                    <button
                        type="button"
                        className="fotogrids-nav-arrow fotogrids-nav-next"
                        onClick={() => onNavigate('next')}
                        title={strings.nextImage || 'Next image'}
                    >
                        <span className="fotogrids-icon" data-icon="chevron-right"></span>
                    </button>
                </>
            )}
        </div>
    );
};

export default ModalStructure;
