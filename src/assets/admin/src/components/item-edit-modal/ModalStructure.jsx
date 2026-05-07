import React from 'react';
import ModalBody from './ModalBody';
import SaveButton from './SaveButton';
import Icon from '../shared/Icon';

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
        <div id="fotogrids-item-edit-modal" className="fotogrids-modal fotogrids-modal--open">
            <div className="fotogrids-modal__overlay" onClick={onClose}></div>
            <div className="fotogrids-modal__content">
                <div className="fotogrids-modal__header">
                    <h3>{strings.editItem || 'Edit Item'}</h3>
                    <button type="button" className="fotogrids-modal__close" onClick={onClose}>
                        ×
                    </button>
                </div>

				<div className="fotogrids-modal__body">
					<ModalBody
						itemData={itemData}
						loading={loading}
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
				</div>

                <div className="fotogrids-modal__footer">
                    {!loading && itemData && (
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
                {hasMultipleItems && (
                    <>
                        <button
                            type="button"
                            className="fotogrids-modal__nav-arrow fotogrids-modal__nav-arrow__prev"
                            onClick={() => onNavigate('prev')}
                            title={strings.prevItem || 'Previous item'}
                        >
                            <Icon name="chevron_left" />
                        </button>
                        <button
                            type="button"
                            className="fotogrids-modal__nav-arrow fotogrids-modal__nav-arrow__next"
                            onClick={() => onNavigate('next')}
                            title={strings.nextItem || 'Next item'}
                        >
                            <Icon name="chevron_right" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default ModalStructure;
