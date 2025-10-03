import React from 'react';
import ModalBody from './ModalBody';
import SaveButton from './SaveButton';

const ModalStructure = ({
    itemId,
    itemData,
    loading,
    items,
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
    const currentIndex = items.findIndex(img => img.id === itemId);
    const hasMultipleItems = items.length > 1;

    return (
        <div id="fotogrids-item-edit-modal" className="fotogrids-modal">
            <div className="fotogrids-modal-content">
                <div className="fotogrids-modal-header">
                    <h3>{strings.editItem || 'Edit Item'}</h3>
                    <button type="button" className="fotogrids-modal-close" onClick={onClose}>
                        ×
                    </button>
                </div>

				<div className="fotogrids-modal-body">
					{loading ? (
						<div className="fotogrids-loading">
							{strings.loading || 'Loading...'}
						</div>
					) : !itemData ? (
						<div className="fotogrids-error">
							Failed loading item data
						</div>
					) : (
						<ModalBody
							itemData={itemData}
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
                    {!loading && itemData && (
                        // <SaveButton
                        //     onClick={handleSave}
                        //     saving={saving}
                        //     hasChanges={hasChanges}
                        //     saveSuccess={saveSuccess}
                        //     strings={strings}
                        // />
						<button
							type="button"
							className="fotogrids-button fotogrids-button--primary"
							onClick={handleSave}
							disabled={!hasChanges || saving}
						>
							{strings.saveChanges || 'Save Changes'}
						</button>
                    )}
                    <button
                        type="button"
                        className="fotogrids-button fotogrids-button--secondary"
                        onClick={onClose}
                    >
                        {strings.close || 'Close'}
                    </button>
                </div>
            </div>

            {/* Navigation arrows */}
            {hasMultipleItems && (
                <>
                    <button
                        type="button"
                        className="fotogrids-nav-arrow fotogrids-nav-prev"
                        onClick={() => onNavigate('prev')}
                        title={strings.prevItem || 'Previous item'}
                    >
                        <span className="fotogrids-icon" data-icon="chevron-left"></span>
                    </button>
                    <button
                        type="button"
                        className="fotogrids-nav-arrow fotogrids-nav-next"
                        onClick={() => onNavigate('next')}
                        title={strings.nextItem || 'Next item'}
                    >
                        <span className="fotogrids-icon" data-icon="chevron-right"></span>
                    </button>
                </>
            )}
        </div>
    );
};

export default ModalStructure;
