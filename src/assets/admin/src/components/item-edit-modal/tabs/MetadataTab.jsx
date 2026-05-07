import React from 'react';

const MetadataTab = ({
    metadata,
    availableMetadata,
    metadataInput,
    setMetadataInput,
    addMetadataItem,
    removeMetadataItem,
    selectExistingMetadata,
    disabled = false,
    strings = {},
    metadataKey,
    inputKey,
    placeholder,
    icon,
    itemClassName = 'fotogrids-metadata-item',
    showProNotice = false,
    proNoticeContent,
    renderItemContent,
    isSingleItem = false,
}) => {
    const handleUpgrade = () => {
        if (window.FotoGridsUpgrade) {
            window.FotoGridsUpgrade.launch();
        } else if (window.fotogridsUpgradeModal?.urls?.upgrade) {
            window.open(window.fotogridsUpgradeModal.urls.upgrade, '_blank');
        }
    };

    const currentInput = metadataInput?.[inputKey] || '';
    // For single items, use inputKey to get the item (e.g., metadata.location)
    // For arrays, use metadataKey (e.g., metadata.tags)
    const currentItems = isSingleItem
        ? (metadata[inputKey] ? [metadata[inputKey]] : [])
        : (metadata[metadataKey] || []);
    const availableItems = availableMetadata[metadataKey] || [];

    const filteredSuggestions = availableItems
        .filter(item => {
            if (!item || !item.name) return false;
            if (!currentInput) return false;

            const matchesInput = item.name.toLowerCase().includes(currentInput.toLowerCase());

            if (isSingleItem) {
                return matchesInput && (!metadata[inputKey] || metadata[inputKey].id !== item.id);
            } else {
                return matchesInput && !currentItems.some(existing => existing.id === item.id);
            }
        })
        .slice(0, 5);

    const hasSuggestions = filteredSuggestions.length > 0;

    const handleKeyEvent = (e) => {
        if (!disabled && e.key === 'Enter') {
            e.preventDefault();
            addMetadataItem(metadataKey, currentInput);
        }
    };

    const inputElement = (
        <input
            type="text"
            placeholder={placeholder}
            value={currentInput}
            onChange={(e) => setMetadataInput(prev => ({ ...prev, [inputKey]: e.target.value }))}
            onKeyDown={handleKeyEvent}
            disabled={disabled}
            className="fotogrids-input"
        />
    );

    return (
        <div className="fotogrids-tab-panel fg-is-active">
            <div className="fotogrids-metadata-section">
                <div className="fotogrids-metadata-input">
                    {icon ? (
                        <div className="fotogrids-input-with-icon">
                            <span className="fotogrids-input-icon" dangerouslySetInnerHTML={{ __html: icon }} />
                            {inputElement}
                        </div>
                    ) : (
                        inputElement
                    )}
                    <button
                        type="button"
                        className="fotogrids-button fotogrids-button--primary fotogrids-button--outline"
                        onClick={() => !disabled && addMetadataItem(metadataKey, currentInput)}
                        disabled={disabled}
                    >
                        {strings.add}
                    </button>
                </div>

                {/* Autocomplete suggestions */}
                {currentInput && hasSuggestions && (
                    <div className="fotogrids-autocomplete">
                        {filteredSuggestions.map(item => (
                            <div
                                key={item.id}
                                className="fotogrids-autocomplete-item"
                                onClick={() => selectExistingMetadata(metadataKey, item)}
                            >
                                {item.name}
                            </div>
                        ))}
                    </div>
                )}

                {/* Pro feature notice */}
                {showProNotice && proNoticeContent && (
                    <div className="fotogrids-pro-feature-notice">
                        <div className="fotogrids-pro-feature-notice__content">
                            <span className="fotogrids-pro-badge">{proNoticeContent.badge || strings.pro}</span>
                            <span className="fotogrids-pro-feature-notice__text">
                                <strong>{proNoticeContent.title}</strong> {proNoticeContent.description}
                            </span>
                        </div>
                        <button
                            type="button"
                            className="fotogrids-button fotogrids-button--link"
                            onClick={handleUpgrade}
                        >
                            {proNoticeContent.upgradeText || strings.upgradeToPro}
                        </button>
                    </div>
                )}

                {/* Current items */}
                {currentItems.length > 0 && (
                    <div className="fotogrids-metadata-list">
                        {currentItems.map(item => (
                            <span key={item.id} className={itemClassName}>
                                {renderItemContent ? renderItemContent(item) : (
                                    <>
                                        <span className={itemClassName.includes('fotogrids-tag') ? 'fotogrids-tag-text' : ''}>
                                            {item.name}
                                        </span>
                                        {item.latitude && item.longitude && (
                                            <span className="fotogrids-metadata-item__coordinates">
                                                ({item.latitude.toFixed(4)}, {item.longitude.toFixed(4)})
                                            </span>
                                        )}
                                    </>
                                )}
                                <button
                                    type="button"
                                    className="fotogrids-tag-remove-button"
                                    onClick={() => !disabled && removeMetadataItem(isSingleItem ? inputKey : metadataKey, item.id)}
                                    disabled={disabled}
                                    aria-label="Remove"
                                    dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.x || 'x' }}
                                />
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MetadataTab;
