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
        link_target: 'global'
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

    // Update form data when itemData changes
    useEffect(() => {
        if (itemData) {
            const initialFormData = {
                title: itemData.title || '',
                alt: itemData.alt || '',
                caption: itemData.caption || '',
                description: itemData.description || '',
                location: itemData.location || '',
                external_url: itemData.external_url || '',
                link_target: itemData.link_target || 'global'
            };
            setFormData(initialFormData);
            setOriginalData(initialFormData);
            setHasChanges(false);
            setSaveSuccess(false); // Reset success state when switching items
        }
    }, [itemData]);

    // Load metadata when modal opens
    useEffect(() => {
        if (itemId) {
            loadItemMetadata();
            loadAvailableMetadata();
        }
    }, [itemId]);

    // Track changes in form data and metadata
    useEffect(() => {
        if (!originalData || !originalMetadata) return;

        // Compare form data
        const formDataChanged = Object.keys(originalData).some(key => 
            originalData[key] !== formData[key]
        );

        // Compare metadata (tags, people, location)
        const metadataChanged = 
            // Check tags
            (originalMetadata.tags.length !== metadata.tags.length) ||
            originalMetadata.tags.some(tag => !metadata.tags.find(t => t.id === tag.id)) ||
            // Check people
            (originalMetadata.people.length !== metadata.people.length) ||
            originalMetadata.people.some(person => !metadata.people.find(p => p.id === person.id)) ||
            // Check location
            (originalMetadata.location?.id !== metadata.location?.id);

        setHasChanges(formDataChanged || metadataChanged);
    }, [formData, originalData, metadata, originalMetadata]);

    const loadItemMetadata = async () => {
        try {
            const response = await fetch(`${window.wpApiSettings.root}fotogrids/v1/metadata/item/${itemId}?_wpnonce=${encodeURIComponent(window.wpApiSettings.nonce)}`);
            const data = await response.json();
            
            const initialMetadata = {
                tags: data.tags || [],
                people: data.people || [],
                location: data.location || null
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

    // Metadata handling functions
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

            // Add to available metadata if not already there
            setAvailableMetadata(prev => ({
                ...prev,
                [type]: prev[type].some(item => item.id === newItem.id) 
                    ? prev[type] 
                    : [...prev[type], newItem]
            }));

            // Clear input
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
            // Save item-metadata relationships
            const metadataToSave = {
                tags: metadata.tags.map(tag => tag.id),
                people: metadata.people.map(person => person.id),
                location: metadata.location ? metadata.location.id : null
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
                formDataToSend.append(key, value);
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
            } else {
                alert(strings.errorSaving || 'Error saving item data');
                setSaving(false);
            }
        } catch (error) {
            alert(strings.errorSaving || 'Error saving item data');
            setSaving(false);
        }
    };

    return (
        <ModalStructure
            itemId={itemId}
            itemData={itemData}
            loading={loading}
            items={items}
            onClose={onClose}
            onNavigate={onNavigate}
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
