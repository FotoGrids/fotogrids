import React, { useState, useEffect } from 'react';
import ModalStructure from './imageEditModal/ModalStructure';

const ImageEditModal = ({ 
    imageId, 
    imageData, 
    loading, 
    images, 
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

    // Update form data when imageData changes
    useEffect(() => {
        if (imageData) {
            const initialFormData = {
                title: imageData.title || '',
                alt: imageData.alt || '',
                caption: imageData.caption || '',
                description: imageData.description || '',
                location: imageData.location || '',
                external_url: imageData.external_url || '',
                link_target: imageData.link_target || 'global'
            };
            setFormData(initialFormData);
            setOriginalData(initialFormData);
            setHasChanges(false);
            setSaveSuccess(false); // Reset success state when switching images
        }
    }, [imageData]);

    // Load metadata when modal opens
    useEffect(() => {
        if (imageId) {
            loadImageMetadata();
            loadAvailableMetadata();
        }
    }, [imageId]);

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

    const loadImageMetadata = async () => {
        try {
            const response = await fetch(`${window.wpApiSettings.root}fotogrids/v1/metadata/image/${imageId}?_wpnonce=${encodeURIComponent(window.wpApiSettings.nonce)}`);
            const data = await response.json();
            
            const initialMetadata = {
                tags: data.tags || [],
                people: data.people || [],
                location: data.location || null
            };
            
            setMetadata(initialMetadata);
            setOriginalMetadata(initialMetadata);
        } catch (error) {
            console.warn('Failed to load image metadata:', error);
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

    const saveImageMetadata = async () => {
        try {
            // Save image-metadata relationships
            const metadataToSave = {
                tags: metadata.tags.map(tag => tag.id),
                people: metadata.people.map(person => person.id),
                location: metadata.location ? metadata.location.id : null
            };

            await fetch(`${window.wpApiSettings.root}fotogrids/v1/metadata/image/${imageId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': window.wpApiSettings.nonce
                },
                body: JSON.stringify(metadataToSave)
            });
        } catch (error) {
            console.warn('Failed to save image metadata:', error);
        }
    };

    const handleSave = async () => {
        setSaving(true);
                
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('action', 'fotogrids_save_image_data');
            formDataToSend.append('image_id', imageId);
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
                await saveImageMetadata();
                
                setOriginalData({ ...formData });
                setOriginalMetadata({
                    tags: [...metadata.tags],
                    people: [...metadata.people],
                    location: metadata.location ? { ...metadata.location } : null
                });
                
                setHasChanges(false);                
                setSaving(false);
            } else {
                alert(strings.errorSaving || 'Error saving image data');
                setSaving(false);
            }
        } catch (error) {
            alert(strings.errorSaving || 'Error saving image data');
            setSaving(false);
        }
    };

    return (
        <ModalStructure
            imageId={imageId}
            imageData={imageData}
            loading={loading}
            images={images}
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

export default ImageEditModal;
