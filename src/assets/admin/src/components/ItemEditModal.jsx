import React, { useState, useEffect } from 'react';
import ModalStructure from './item-edit-modal/ModalStructure';

const ItemEditModal = ({
    itemId,
    itemData,
    loading,
    items,
    onClose,
    onNavigate,
    ajaxUrl,
    nonce,
    strings
}) => {
    const [activeTab, setActiveTab] = useState('details');
    const [formData, setFormData] = useState({
        title: '',
        alt: '',
        caption: '',
        description: '',
        location: '',
        external_url: '',
        link_target: 'global',
        exif: {}
    });
    const [metadata, setMetadata] = useState({
        tags: [],
        people: [],
        location: null
    });
    const [availableMetadata, setAvailableMetadata] = useState({
        tags: [],
        people: [],
        locations: []
    });
    const [metadataInput, setMetadataInput] = useState({
        tags: '',
        people: '',
        location: ''
    });
    const [saving, setSaving] = useState(false);
    const [originalData, setOriginalData] = useState(null);
    const [originalMetadata, setOriginalMetadata] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        if (itemData) {
            const initialFormData = {
                title: itemData.title || '',
                alt: itemData.alt || '',
                caption: itemData.caption || '',
                description: itemData.description || '',
                location: itemData.location || '',
                external_url: itemData.external_url || '',
                link_target: itemData.link_target || 'global',
                exif: itemData.exif || {}
            };
            setFormData(initialFormData);
            setOriginalData(initialFormData);
            setHasChanges(false);
            setSaveSuccess(false);
        }
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
            (originalMetadata.location?.id !== metadata.location?.id);

        setHasChanges(formDataChanged || metadataChanged);
    }, [formData, originalData, metadata, originalMetadata]);

    const loadItemMetadata = async () => {
        try {
            const response = await fetch(`${window.wpApiSettings.root}fotogrids/v1/metadata/item/${itemId}?_wpnonce=${encodeURIComponent(window.wpApiSettings.nonce)}`);
            const data = await response.json();

            const location = (data.locations && data.locations.length > 0) ? data.locations[0] : null;

            const initialMetadata = {
                tags: data.tags || [],
                people: data.people || [],
                location: location
            };

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

            if (type === 'locations') {
                setMetadata(prev => ({ ...prev, location: newItem }));
            } else {
                setMetadata(prev => ({
                    ...prev,
                    [type]: [...prev[type], newItem]
                }));
            }

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
        if (type === 'location') {
            setMetadata(prev => ({ ...prev, location: null }));
        } else {
            setMetadata(prev => ({
                ...prev,
                [type]: prev[type].filter(item => item.id !== itemId)
            }));
        }
    };

    const selectExistingMetadata = (type, item) => {
        if (type === 'locations') {
            setMetadata(prev => ({ ...prev, location: item }));
        } else {
            const exists = metadata[type].some(existing => existing.id === item.id);
            if (!exists) {
                setMetadata(prev => ({
                    ...prev,
                    [type]: [...prev[type], item]
                }));
            }
        }
        setMetadataInput(prev => ({ ...prev, [type]: '' }));
    };

    const saveItemMetadata = async () => {
        try {
            const tagsToSave = metadata.tags.map(tag => tag.id);

            const peopleToSave = metadata.people.map(person => ({
                name: person.name || '',
                details: person.details || ''
            }));

            const locationsToSave = metadata.location ? [{
                name: metadata.location.name || '',
                latitude: metadata.location.latitude || null,
                longitude: metadata.location.longitude || null
            }] : [];

            const metadataToSave = {
                tags: tagsToSave,
                people: peopleToSave,
                locations: locationsToSave
            };

            await fetch(`${window.wpApiSettings.root}fotogrids/v1/metadata/item/${itemId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': window.wpApiSettings.nonce
                },
                body: JSON.stringify(metadataToSave)
            });
        } catch (error) {
            console.warn('Failed to save item metadata:', error);
        }
    };

    const handleSave = async () => {
        setSaving(true);

        try {
            const formDataToSend = new FormData();
            formDataToSend.append('action', 'fotogrids_save_item_data');
            formDataToSend.append('item_id', itemId);
            formDataToSend.append('nonce', nonce);

            Object.entries(formData).forEach(([key, value]) => {
                if (key === 'exif' && typeof value === 'object') {
                    formDataToSend.append(key, JSON.stringify(value));
                } else {
                    formDataToSend.append(key, value);
                }
            });

            const response = await fetch(ajaxUrl, {
                method: 'POST',
                body: formDataToSend
            });

            const data = await response.json();

            if (data.success) {
                await saveItemMetadata();

                setOriginalData({ ...formData });
                setOriginalMetadata({
                    tags: [...metadata.tags],
                    people: [...metadata.people],
                    location: metadata.location ? { ...metadata.location } : null
                });

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

                if (window.fotogridsToast) {
                    window.fotogridsToast.error(
                        data.message || strings.errorSaving
                    );
                } else {
                    alert(data.message || strings.errorSaving);
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

    return (
        <ModalStructure
            itemId={itemId}
            itemData={itemData}
            loading={loading}
            items={items}
            onClose={handleClose}
            onNavigate={handleNavigate}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            formData={formData}
            handleInputChange={handleInputChange}
            metadata={metadata}
            availableMetadata={availableMetadata}
            metadataInput={metadataInput}
            setMetadataInput={setMetadataInput}
            addMetadataItem={addMetadataItem}
            removeMetadataItem={removeMetadataItem}
            selectExistingMetadata={selectExistingMetadata}
            handleSave={handleSave}
            saving={saving}
            hasChanges={hasChanges}
            saveSuccess={saveSuccess}
            strings={strings}
        />
    );
};

export default ItemEditModal;
