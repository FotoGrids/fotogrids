import React, { useState, useEffect } from 'react';
import { ItemPreviewPane, ItemEditTabs } from './item-edit-modal/ModalBody';
import { Modal } from './shared/Modal';
import { Button } from './shared/Button';

/**
 * Metadata type registry.
 *
 * Pro (or any extension) can register additional metadata types that will be
 * included in the item save payload automatically. Call this before the modal
 * mounts - typically from the Pro plugin's admin JS entry point.
 *
 * Example (Pro plugin):
 *   window.FotoGridsAdmin.registerMetadataType({
 *     key: 'subjects',
 *     serialize:   (metadata) => metadata.subjects?.map(s => s.id) ?? [],
 *     deserialize: (data)     => data.subjects ?? [],
 *   });
 *
 * Each registration object must provide:
 *   key         {string}   - The state key used in `metadata` and the payload field name.
 *   serialize   {Function} - Converts the current metadata state slice to a saveable value.
 *   deserialize {Function} - Converts the API load response into the initial state slice.
 */
const _metadataTypeRegistry = [];

window.FotoGridsAdmin = window.FotoGridsAdmin || {};
window.FotoGridsAdmin.registerMetadataType = ( registration ) => {
    if ( ! registration?.key || typeof registration.serialize !== 'function' || typeof registration.deserialize !== 'function' ) {
        console.warn( '[FotoGrids] registerMetadataType: invalid registration - key, serialize, and deserialize are required.', registration );
        return;
    }
    if ( _metadataTypeRegistry.some( r => r.key === registration.key ) ) {
        console.warn( `[FotoGrids] registerMetadataType: type "${ registration.key }" is already registered.` );
        return;
    }
    _metadataTypeRegistry.push( registration );
};

const ItemEditModal = ({
    itemId,
    itemData,
    loading,
    items,
    onClose,
    onNavigate,
    strings
}) => {
    const [activeTab, setActiveTab] = useState('details');
    const [formData, setFormData] = useState({
        title: '',
        alt: '',
        caption: '',
        description: '',
        credit: '',
        external_url: '',
        link_target: 'global',
        exif: {}
    });
    const [metadata, setMetadata] = useState({
        tags: [],
        people: [],
        locations: []
    });
    const [availableMetadata, setAvailableMetadata] = useState({
        tags: [],
        people: [],
        locations: []
    });
    const [metadataInput, setMetadataInput] = useState({
        tags: '',
        people: '',
        locations: ''
    });
    const [saving, setSaving] = useState(false);
    const [originalData, setOriginalData] = useState(null);
    const [originalMetadata, setOriginalMetadata] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [videoSettings, setVideoSettings] = useState({});
    const [originalVideoSettings, setOriginalVideoSettings] = useState({});

    useEffect(() => {
        if (itemData) {
            const initialFormData = {
                title: itemData.title || '',
                alt: itemData.alt || '',
                caption: itemData.caption || '',
                description: itemData.description || '',
                credit: itemData.credit || '',
                external_url: itemData.external_url || '',
                link_target: itemData.link_target || 'global',
                exif: itemData.exif || {}
            };
            setFormData(initialFormData);
            setOriginalData(initialFormData);
            setHasChanges(false);
            setSaveSuccess(false);

            // Seed video settings from custom_data for Media Library videos.
            if (itemData.item_type === 'video_file') {
                const cd = itemData.custom_data || {};
                const initialVideo = {
                    autoplay:   !!cd.autoplay,
                    mute:       !!cd.mute,
                    loop:       !!cd.loop,
                    controls:   cd.controls === undefined ? true : !!cd.controls,
                    poster_id:  cd.poster_id || 0,
                    poster_url: cd.poster_url || '',
                    poster_preview: itemData.poster_url || cd.poster_url || '',
                };
                setVideoSettings(initialVideo);
                setOriginalVideoSettings(initialVideo);
            } else {
                setVideoSettings({});
                setOriginalVideoSettings({});
            }

            // The Video tab only exists for video files; if we navigated away
            // from a video while it was active, fall back to Details.
            if (activeTab === 'video' && itemData.item_type !== 'video_file') {
                setActiveTab('details');
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemData]);

    useEffect(() => {
        if (itemId) {
            loadItemMetadata();
            loadAvailableMetadata();
        }
    }, [itemId]);

    useEffect(() => {
        if (!originalData || !originalMetadata) return;

        const formDataChanged = Object.keys(originalData).some(key =>
            originalData[key] !== formData[key]
        );

        const metadataChanged =
            (originalMetadata.tags.length !== metadata.tags.length) ||
            originalMetadata.tags.some(tag => !metadata.tags.find(t => t.id === tag.id)) ||
            (originalMetadata.people.length !== metadata.people.length) ||
            originalMetadata.people.some(person => !metadata.people.find(p => p.id === person.id)) ||
            (originalMetadata.locations[0]?.id !== metadata.locations[0]?.id);

        const videoChanged = ['autoplay', 'mute', 'loop', 'controls', 'poster_id', 'poster_url'].some(
            key => (originalVideoSettings[key] ?? '') !== (videoSettings[key] ?? '')
        );

        setHasChanges(formDataChanged || metadataChanged || videoChanged);
    }, [formData, originalData, metadata, originalMetadata, videoSettings, originalVideoSettings]);

    const loadItemMetadata = async () => {
        try {
            const response = await fetch(`${window.wpApiSettings.root}fotogrids/v1/metadata/item/${itemId}?_wpnonce=${encodeURIComponent(window.wpApiSettings.nonce)}`);
            const data = await response.json();

            const initialMetadata = {
                tags: data.tags || [],
                people: data.people || [],
                locations: data.locations || []
            };

            // Allow registered extension types to hydrate their own state slices.
            _metadataTypeRegistry.forEach(({ key, deserialize }) => {
                initialMetadata[key] = deserialize(data);
            });

            setMetadata(initialMetadata);
            setOriginalMetadata(initialMetadata);
        } catch (error) {
            console.warn('Failed to load item metadata:', error);
        }
    };

    const loadAvailableMetadata = async () => {
        try {
            const [tagsResponse, peopleResponse, locationsResponse] = await Promise.all([
                fetch(`${window.wpApiSettings.root}fotogrids/v1/metadata/tags?_wpnonce=${encodeURIComponent(window.wpApiSettings.nonce)}`),
                fetch(`${window.wpApiSettings.root}fotogrids/v1/metadata/people?_wpnonce=${encodeURIComponent(window.wpApiSettings.nonce)}`),
                fetch(`${window.wpApiSettings.root}fotogrids/v1/metadata/locations?_wpnonce=${encodeURIComponent(window.wpApiSettings.nonce)}`)
            ]);

            const [tagsData, peopleData, locationsData] = await Promise.all([
                tagsResponse.json(),
                peopleResponse.json(),
                locationsResponse.json()
            ]);

            setAvailableMetadata({
                tags: tagsData || [],
                people: peopleData || [],
                locations: locationsData || []
            });
        } catch (error) {
            console.warn('Failed to load available metadata:', error);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const addMetadataItem = async (type, value) => {
        if (!value.trim()) return;

        try {
            const response = await fetch(`${window.wpApiSettings.root}fotogrids/v1/metadata/${type}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': window.wpApiSettings.nonce
                },
                body: JSON.stringify({ name: value.trim() })
            });

            const newItem = await response.json();

            // For replace-type keys (maxItems === 1, e.g. locations), replace
            // the existing entry rather than appending.
            const REPLACE_TYPES = ['locations'];
            setMetadata(prev => ({
                ...prev,
                [type]: REPLACE_TYPES.includes(type) ? [newItem] : [...prev[type], newItem]
            }));

            setAvailableMetadata(prev => ({
                ...prev,
                [type]: prev[type].some(item => item.id === newItem.id)
                    ? prev[type]
                    : [...prev[type], newItem]
            }));

            setMetadataInput(prev => ({ ...prev, [type]: '' }));
        } catch (error) {
            console.warn(`Failed to add ${type}:`, error);
        }
    };

    const removeMetadataItem = (type, itemId) => {
        setMetadata(prev => ({
            ...prev,
            [type]: prev[type].filter(item => item.id !== itemId)
        }));
    };

    const selectExistingMetadata = (type, item) => {
        // For single-item types (locations), replace rather than append.
        const isSingleType = type === 'locations';
        const alreadySelected = metadata[type].some(existing => existing.id === item.id);

        if (!alreadySelected) {
            setMetadata(prev => ({
                ...prev,
                [type]: isSingleType ? [item] : [...prev[type], item]
            }));
        }

        setMetadataInput(prev => ({ ...prev, [type]: '' }));
    };

    const handleSave = async () => {
        setSaving(true);

        try {
            const payload = {
                ...formData,
                tags: metadata.tags.map(tag => tag.id),
                people: metadata.people.map(person => ({
                    id: person.id,
                    name: person.name || '',
                    details: person.details || ''
                })),
                locations: metadata.locations.map(loc => ({
                    id: loc.id,
                    name: loc.name || '',
                    latitude: loc.latitude || null,
                    longitude: loc.longitude || null
                }))
            };

            // Allow registered extension types to append their own payload fields.
            _metadataTypeRegistry.forEach(({ key, serialize }) => {
                payload[key] = serialize(metadata);
            });

            // Video items send their poster + playback settings for custom_data.
            if (itemData?.item_type === 'video_file') {
                payload.video_settings = {
                    autoplay:   !!videoSettings.autoplay,
                    mute:       !!videoSettings.mute,
                    loop:       !!videoSettings.loop,
                    controls:   videoSettings.controls === undefined ? true : !!videoSettings.controls,
                    poster_id:  videoSettings.poster_id || 0,
                    poster_url: videoSettings.poster_url || '',
                };
            }

            const response = await fetch(
                `${window.wpApiSettings.root}fotogrids/v1/items/${itemId}/save`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': window.wpApiSettings.nonce
                    },
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();

            if (response.ok && data.success) {
                setOriginalData({ ...formData });
                setOriginalMetadata({
                    tags: [...metadata.tags],
                    people: [...metadata.people],
                    locations: [...metadata.locations]
                });
                setOriginalVideoSettings({ ...videoSettings });

                setHasChanges(false);
                setSaving(false);
                setSaveSuccess(true);

                if (window.fotogridsToast) {
                    window.fotogridsToast.success(
                        strings.itemSavedSuccessfully || data.message || 'Item saved successfully!'
                    );
                }
            } else {
                setSaving(false);

                const errorMessage = data.message || strings.errorSaving;
                if (window.fotogridsToast) {
                    window.fotogridsToast.error(errorMessage);
                } else {
                    alert(errorMessage);
                }
            }
        } catch (error) {
            setSaving(false);

            if (window.fotogridsToast) {
                window.fotogridsToast.error(strings.errorSaving);
            } else {
                alert(strings.errorSaving);
            }
        }
    };

    const handleClose = () => {
        if (saving) {
            return;
        }

        if (hasChanges) {
            const confirmMessage = strings.unsavedChangesConfirm ||
                'You have unsaved changes. Are you sure you want to close without saving?';

            if (!window.confirm(confirmMessage)) {
                return;
            }
        }

        setHasChanges(false);
        onClose();
    };

    const handleNavigate = (direction) => {
        if (saving) {
            return;
        }

        if (hasChanges) {
            const confirmMessage = strings.unsavedChangesNavigate ||
                'You have unsaved changes. Are you sure you want to navigate away without saving?';

            if (!window.confirm(confirmMessage)) {
                return;
            }
        }

        setHasChanges(false);
        onNavigate(direction);
    };

    const currentIndex = items.findIndex(img => img.id === itemId);
    const hasMultipleItems = items.length > 1;

    return (
        <Modal
            isOpen
            onClose={handleClose}
            size="lg"
            hasSidebar
            preventClose={saving}
            type="item-edit"
        >
            <Modal.Header>
                <Modal.HeaderTitle>{strings.editItem || 'Edit Item'}</Modal.HeaderTitle>
            </Modal.Header>

            <Modal.Body padding={false}>
                <Modal.Sidebar>
                    <ItemPreviewPane
                        itemData={itemData}
                        loading={loading}
                        formData={formData}
                        strings={strings}
                    />
                </Modal.Sidebar>

                <Modal.Main>
                    <ItemEditTabs
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
                        videoSettings={videoSettings}
                        setVideoSettings={setVideoSettings}
                        strings={strings}
                    />
                </Modal.Main>
            </Modal.Body>

            <Modal.Footer>
                {!loading && itemData && (
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        disabled={!hasChanges}
                        busy={saving}
                    >
                        {strings.saveChanges || 'Save Changes'}
                    </Button>
                )}
                <Button variant="secondary" onClick={handleClose} disabled={saving}>
                    {strings.close || 'Close'}
                </Button>
            </Modal.Footer>

            {hasMultipleItems && (
                <>
                    <Modal.Nav
                        direction="prev"
                        onClick={() => handleNavigate('prev')}
                        ariaLabel={strings.prevItem || 'Previous item'}
                    />
                    <Modal.Nav
                        direction="next"
                        onClick={() => handleNavigate('next')}
                        ariaLabel={strings.nextItem || 'Next item'}
                    />
                </>
            )}
        </Modal>
    );
};

export default ItemEditModal;
