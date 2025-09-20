import React, { useState, useEffect } from 'react';

const AlbumGalleries = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [assignedGalleries, setAssignedGalleries] = useState([]);
    const [allGalleries, setAllGalleries] = useState([]);
    const [availableGalleries, setAvailableGalleries] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState(null);
    const [draggedItem, setDraggedItem] = useState(null);

    const config = window.fotogridsAlbumGalleries;


    useEffect(() => {
        if (config) {
            setAssignedGalleries(config.assignedGalleries || []);
            setAllGalleries(config.allGalleries || []);
        }
    }, []);

    // Recalculate available galleries when assigned galleries change
    useEffect(() => {
        if (allGalleries.length > 0) {
            const assignedIds = assignedGalleries.map(g => parseInt(g.ID));
            const available = allGalleries.filter(g => !assignedIds.includes(parseInt(g.id)));
            setAvailableGalleries(available);
        }
    }, [assignedGalleries, allGalleries]);

    const filteredAvailableGalleries = availableGalleries.filter(gallery =>
        gallery.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddGallery = async (galleryId) => {
        setSaving(true);
        setError(null);

        try {
            await window.wp.apiFetch({
                path: `${config.restUrl}admin/albums/${config.postId}/galleries`,
                method: 'POST',
                headers: {
                    'X-WP-Nonce': config.nonce,
                },
                data: {
                    gallery_ids: [galleryId],
                },
            });

            // Move gallery from available to assigned
            const galleryToAdd = allGalleries.find(g => g.id === galleryId);
            if (galleryToAdd) {
                const newAssignedGallery = {
                    ID: galleryToAdd.id,
                    post_title: galleryToAdd.title,
                    image_count: galleryToAdd.image_count,
                    layout: galleryToAdd.layout,
                    featured_image: galleryToAdd.featured_image,
                    sample_images: galleryToAdd.sample_images,
                    position: assignedGalleries.length,
                };
                setAssignedGalleries(prev => [...prev, newAssignedGallery]);
                setAvailableGalleries(prev => prev.filter(g => g.id !== galleryId));
            }

            setSaveMessage(config.strings.saved);
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (err) {
            console.error('API Error:', err);
            setError(err.message || config.strings.error);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveGallery = async (galleryId) => {
        setSaving(true);
        setError(null);

        try {
            await window.wp.apiFetch({
                path: `${config.restUrl}admin/albums/${config.postId}/galleries/${galleryId}`,
                method: 'DELETE',
                headers: {
                    'X-WP-Nonce': config.nonce,
                },
            });

            // Move gallery from assigned to available
            const galleryToRemove = assignedGalleries.find(g => g.ID === galleryId);
            if (galleryToRemove) {
                const availableGallery = {
                    id: galleryToRemove.ID,
                    title: galleryToRemove.post_title,
                    image_count: galleryToRemove.image_count,
                    layout: galleryToRemove.layout,
                    featured_image: galleryToRemove.featured_image,
                    status: 'publish', // Assuming published
                };
                setAvailableGalleries(prev => [...prev, availableGallery]);
                setAssignedGalleries(prev => prev.filter(g => g.ID !== galleryId));
                
            }

            setSaveMessage(config.strings.saved);
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (err) {
            console.error('API Error:', err);
            setError(err.message || config.strings.error);
        } finally {
            setSaving(false);
        }
    };

    const handleReorderGalleries = async (newOrder) => {
        setSaving(true);
        setError(null);

        try {
            const galleryIds = newOrder.map(g => g.ID);
            await window.wp.apiFetch({
                path: `${config.restUrl}admin/albums/${config.postId}/galleries/reorder`,
                method: 'PUT',
                headers: {
                    'X-WP-Nonce': config.nonce,
                },
                data: {
                    gallery_ids: galleryIds,
                },
            });

            setAssignedGalleries(newOrder);
            setSaveMessage(config.strings.saved);
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (err) {
            console.error('API Error:', err);
            setError(err.message || config.strings.error);
        } finally {
            setSaving(false);
        }
    };

    const handleDragStart = (e, gallery) => {
        setDraggedItem(gallery);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetGallery) => {
        e.preventDefault();
        if (!draggedItem || draggedItem.ID === targetGallery.ID) return;

        const currentIndex = assignedGalleries.findIndex(g => g.ID === draggedItem.ID);
        const targetIndex = assignedGalleries.findIndex(g => g.ID === targetGallery.ID);

        const newOrder = [...assignedGalleries];
        newOrder.splice(currentIndex, 1);
        newOrder.splice(targetIndex, 0, draggedItem);

        handleReorderGalleries(newOrder);
        setDraggedItem(null);
    };


    if (!config) {
        return React.createElement('div', { className: 'fotogrids-error' },
            React.createElement('p', null, 'Configuration not loaded')
        );
    }

    return React.createElement('div', { className: 'fotogrids-album-galleries' },

        // Assigned Galleries Section
        React.createElement('div', { className: 'fotogrids-assigned-section' },
            React.createElement('h4', null, 
                `${config.strings.assignedGalleries} (${assignedGalleries.length})`
            ),
            
            assignedGalleries.length === 0 
                ? React.createElement('p', { className: 'fotogrids-no-galleries' }, 
                    config.strings.noGalleriesAssigned)
                : React.createElement('div', { className: 'fotogrids-assigned-galleries' },
                    React.createElement('p', { className: 'fotogrids-drag-hint' }, 
                        config.strings.dragToReorder),
                    assignedGalleries.map((gallery, index) =>
                        React.createElement('div', {
                            key: gallery.ID,
                            className: 'fotogrids-gallery-item assigned',
                            draggable: true,
                            onDragStart: (e) => handleDragStart(e, gallery),
                            onDragOver: handleDragOver,
                            onDrop: (e) => handleDrop(e, gallery)
                        },
                            React.createElement('div', { className: 'fotogrids-gallery-drag' }, '⋮⋮'),
                            // Image stack display
                            React.createElement('div', { className: 'fotogrids-gallery-images' },
                                gallery.sample_images && gallery.sample_images.length > 0 
                                    ? gallery.sample_images.slice(0, 4).map((imageUrl, index) =>
                                        React.createElement('img', {
                                            key: index,
                                            src: imageUrl,
                                            alt: '',
                                            className: `fotogrids-gallery-thumb fgg-stack-${index}`
                                        })
                                    )
                                    : gallery.featured_image && React.createElement('img', {
                                        src: gallery.featured_image,
                                        alt: '',
                                        className: 'fotogrids-gallery-thumb'
                                    })
                            ),
                            React.createElement('div', { className: 'fotogrids-gallery-details' },
                                React.createElement('strong', { className: 'fotogrids-gallery-title' }, 
                                    gallery.post_title),
                                React.createElement('span', { className: 'fotogrids-gallery-meta' },
                                    `${gallery.image_count} ${config.strings.images} • ${gallery.layout}`)
                            ),
                            React.createElement('div', { className: 'fotogrids-gallery-actions' },
                                React.createElement('button', {
                                    type: 'button',
                                    className: 'fotogrids-remove-button',
                                    onClick: () => handleRemoveGallery(gallery.ID),
                                    disabled: saving,
                                    title: config.strings.removeFromAlbum
                                }, '×')
                            )
                        )
                    )
                )
        ),

        // Available Galleries Section
        React.createElement('div', { className: 'fotogrids-available-section' },
            React.createElement('h4', null, config.strings.availableGalleries),
            
            React.createElement('div', { className: 'fotogrids-gallery-search' },
                React.createElement('input', {
                    type: 'text',
                    placeholder: config.strings.searchPlaceholder,
                    value: searchTerm,
                    onChange: (e) => setSearchTerm(e.target.value),
                    className: 'fotogrids-search-input'
                })
            ),

            React.createElement('div', { className: 'fotogrids-available-galleries' },
                filteredAvailableGalleries.length === 0
                    ? React.createElement('p', { className: 'fotogrids-no-galleries' }, 
                        config.strings.noGalleriesAvailable)
                    :                     filteredAvailableGalleries.map(gallery =>
                        React.createElement('div', {
                            key: gallery.id,
                            className: 'fotogrids-gallery-item available'
                        },
                            // Image stack display
                            React.createElement('div', { className: 'fotogrids-gallery-images' },
                                gallery.sample_images && gallery.sample_images.length > 0 
                                    ? gallery.sample_images.slice(0, 4).map((imageUrl, index) =>
                                        React.createElement('img', {
                                            key: index,
                                            src: imageUrl,
                                            alt: '',
                                            className: `fotogrids-gallery-thumb fgg-stack-${index}`
                                        })
                                    )
                                    : gallery.featured_image && React.createElement('img', {
                                        src: gallery.featured_image,
                                        alt: '',
                                        className: 'fotogrids-gallery-thumb'
                                    })
                            ),
                            React.createElement('div', { className: 'fotogrids-gallery-details' },
                                React.createElement('strong', { className: 'fotogrids-gallery-title' }, 
                                    gallery.title),
                                React.createElement('span', { className: 'fotogrids-gallery-meta' },
                                    `${gallery.image_count} ${config.strings.images} • ${gallery.layout}`)
                            ),
                            React.createElement('div', { className: 'fotogrids-gallery-actions' },
                                React.createElement('button', {
                                    type: 'button',
                                    className: 'fotogrids-add-button',
                                    onClick: () => handleAddGallery(gallery.id),
                                    disabled: saving,
                                    title: config.strings.addToAlbum
                                }, '+')
                            )
                        )
                    )
            )
        ),

        // Status Messages
        saving && React.createElement('div', { className: 'fotogrids-saving' },
            React.createElement('span', { className: 'spinner is-active' }),
            config.strings.loading
        ),

        saveMessage && React.createElement('div', { className: 'notice notice-success is-dismissible' },
            React.createElement('p', null, saveMessage)
        ),

        error && React.createElement('div', { className: 'notice notice-error is-dismissible' },
            React.createElement('p', null, error)
        )
    );
};

export default AlbumGalleries;
