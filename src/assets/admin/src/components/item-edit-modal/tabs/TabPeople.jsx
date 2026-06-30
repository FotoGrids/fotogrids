import React from 'react';
import MetadataTab from './MetadataTab';

const { __ } = wp.i18n;

/**
 * TabPeople
 *
 * People metadata tab in the Item Edit modal.
 *
 * Free: manual tag-add/remove with autocomplete, plus a Pro upsell notice
 * for AI Facial Recognition.
 *
 * Pro: when `window.fotogridsSettings.isProActive` is true AND
 * `window.fotogridsSettings.detectedFaces` is populated (injected by Pro
 * before the modal opens), shows a "Detected faces" suggestion strip above
 * the manual input. Each face chip has a "Tag" button that calls
 * selectExistingMetadata / addMetadataItem exactly as autocomplete does.
 *
 * Pro injects detected faces via:
 *   window.fotogridsSettings.detectedFaces = [
 *     { id: 123, name: 'Jane Smith', confidence: 0.91 },   // matched
 *     { id: null, name: null, confidence: null },           // unknown
 *   ];
 * before the modal mounts or when itemData changes.
 */
const FaceChip = ({ face, onTag, onAddNew, disabled }) => {
    const initials = face.name
        ? face.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    const confidencePct = face.confidence != null
        ? `${Math.round(face.confidence * 100)}%`
        : null;

    return (
        <div className="fotogrids-face-chip">
            <div className="fotogrids-face-chip__avatar">{initials}</div>
            <span className="fotogrids-face-chip__name">
                {face.name
                    ? <>{face.name}{confidencePct && <em> - {confidencePct}</em>}</>
                    : <em>{__('Unknown person', 'fotogrids')}</em>
                }
            </span>
            {face.name ? (
                <button
                    type="button"
                    className="fotogrids-face-chip__action"
                    disabled={disabled}
                    onClick={() => !disabled && onTag(face)}
                >
                    {__('Tag', 'fotogrids')}
                </button>
            ) : (
                <button
                    type="button"
                    className="fotogrids-face-chip__action fotogrids-face-chip__action--muted"
                    disabled={disabled}
                    onClick={() => !disabled && onAddNew()}
                >
                    {__('Add new…', 'fotogrids')}
                </button>
            )}
        </div>
    );
};

const TabPeople = ({
    metadata,
    availableMetadata,
    metadataInput,
    setMetadataInput,
    addMetadataItem,
    removeMetadataItem,
    selectExistingMetadata,
    disabled = false,
    strings = {},
}) => {
    const isProActive = Boolean(window.fotogridsSettings?.isProActive);

    // Faces injected by Pro (array of { id, name, confidence }).
    const detectedFaces = isProActive
        ? (window.fotogridsSettings?.detectedFaces || [])
        : [];

    const taggedIds = new Set((metadata?.people || []).map((p) => p.id));
    const pendingFaces = detectedFaces.filter((f) => f.id == null || !taggedIds.has(f.id));

    const proNoticeContent = !isProActive ? {
        badge: strings.pro,
        title: strings.facialRecognition || __('AI Facial Recognition', 'fotogrids'),
        description: strings.facialRecognitionDesc || __('Automatically detect and tag people in your images - no manual tagging needed.', 'fotogrids'),
        upgradeText: strings.upgradeToPro,
    } : null;

    const handleAddNewFromFace = () => {
        setMetadataInput((prev) => ({ ...prev, people: '' }));
        // Focus the input after the state flush.
        setTimeout(() => {
            const input = document.querySelector('.fotogrids-tab-panel .fotogrids-input');
            if (input) input.focus();
        }, 50);
    };

    return (
        <div className="fotogrids-tab-people">
            {/* ── Pro: AI detected faces strip ── */}
            {isProActive && pendingFaces.length > 0 && (
                <div className="fotogrids-faces-detected">
                    <div className="fotogrids-faces-detected__header">
                        <strong>{__('AI detected faces', 'fotogrids')}</strong>
                        <span className="fotogrids-faces-detected__count">
                            {pendingFaces.length}
                        </span>
                    </div>
                    <div className="fotogrids-faces-detected__chips">
                        {pendingFaces.map((face, idx) => (
                            <FaceChip
                                key={face.id ?? `unknown-${idx}`}
                                face={face}
                                disabled={disabled}
                                onTag={(f) => {
                                    // If the face has an id it's a known library person.
                                    if (f.id) {
                                        selectExistingMetadata('people', { id: f.id, name: f.name });
                                    } else {
                                        addMetadataItem('people', f.name);
                                    }
                                }}
                                onAddNew={handleAddNewFromFace}
                            />
                        ))}
                    </div>
                    <div className="fotogrids-faces-detected__divider" />
                </div>
            )}

            {/* ── Shared metadata input + chips ── */}
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
                placeholder={strings.addPeoplePlaceholder || ''}
                iconName="people"
                showProNotice={!isProActive}
                proNoticeContent={proNoticeContent}
                itemClassName="fotogrids-metadata-item fotogrids-tag"
            />
        </div>
    );
};

export default TabPeople;
