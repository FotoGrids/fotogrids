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
    placeholder,
    icon,
    itemClassName = 'fotogrids-metadata-item',
    showProNotice = false,
    proNoticeContent,
    renderItemContent,
    maxItems = Infinity,
}) => {
    const handleUpgrade = () => {
        if (window.FotoGridsUpgrade) {
            window.FotoGridsUpgrade.launch();
        } else if (window.fotogridsUpgradeModal?.urls?.upgrade) {
            window.open(window.fotogridsUpgradeModal.urls.upgrade, '_blank');
        }
    };

    const currentInput = metadataInput?.[metadataKey] || '';
    const currentItems = metadata[metadataKey] || [];
    const availableItems = availableMetadata[metadataKey] || [];

    // "Replace" semantics: when maxItems === 1, the input stays visible so the
    // user can search and replace the existing value. Adding a second item via
    // the Add button or Enter is still blocked - only autocomplete selection
    // (which replaces) is allowed when one item is already present.
    const isReplaceType = maxItems === 1;
    const isHardFull    = !isReplaceType && currentItems.length >= maxItems;

    const filteredSuggestions = availableItems
        .filter(item => {
            if (!item || !item.name) return false;
            if (!currentInput) return false;
            const matchesInput = item.name.toLowerCase().includes(currentInput.toLowerCase());
            return matchesInput && !currentItems.some(existing => existing.id === item.id);
        })
        .slice(0, 5);

    const hasSuggestions = filteredSuggestions.length > 0;

    // For replace-type (location): when one item is set, Enter / Add button
    // create a new entry and replace - handled by selectExistingMetadata /
    // addMetadataItem in ItemEditModal. Block only when truly hard-full.
    const handleKeyEvent = (e) => {
        if (!disabled && !isHardFull && e.key === 'Enter') {
            e.preventDefault();
            addMetadataItem(metadataKey, currentInput);
        }
    };

    const inputElement = (
        <input
            type="text"
            placeholder={placeholder}
            value={currentInput}
            onChange={(e) => setMetadataInput(prev => ({ ...prev, [metadataKey]: e.target.value }))}
            onKeyDown={handleKeyEvent}
            disabled={disabled}
            className="fotogrids-input"
        />
    );

    return (
        <div className="fotogrids-tab-panel fg-is-active">
            <div className="fotogrids-metadata-section">
                {!isHardFull && (
                    <div className="fotogrids-metadata-input">
                        {icon ? (
                            <div className="fotogrids-input-with-icon">
                                <span className="fotogrids-input-icon" dangerouslySetInnerHTML={{ __html: icon }} />
                                {inputElement}
                            </div>
                        ) : (
                            inputElement
                        )}
                        {/* For replace-type, hide the Add button when an item is
                            already set - the user should select from autocomplete
                            to replace, not add a second entry. */}
                        {(!isReplaceType || currentItems.length === 0) && (
                            <button
                                type="button"
                                className="fotogrids-button fotogrids-button--primary fotogrids-button--outline"
                                onClick={() => !disabled && addMetadataItem(metadataKey, currentInput)}
                                disabled={disabled}
                            >
                                {strings.add}
                            </button>
                        )}
                    </div>
                )}

                {/* Autocomplete suggestions */}
                {!isHardFull && currentInput && hasSuggestions && (
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
                                    onClick={() => !disabled && removeMetadataItem(metadataKey, item.id)}
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
