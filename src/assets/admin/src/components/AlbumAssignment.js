import React, { useState, useEffect } from 'react';

const AlbumAssignment = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [assignedAlbums, setAssignedAlbums] = useState([]);
    const [allAlbums, setAllAlbums] = useState([]);
    const [filteredAlbums, setFilteredAlbums] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState(null);

    const config = window.fotogridsAlbumAssignment;

    useEffect(() => {
        if (config) {
            setAssignedAlbums(config.assignedAlbums || []);
            setAllAlbums(config.allAlbums || []);
            setFilteredAlbums(config.allAlbums || []);
        }
    }, []);

    useEffect(() => {
        // Filter albums based on search term and exclude already assigned albums
        const assignedAlbumIds = assignedAlbums.map(album => parseInt(album.ID));
        const availableAlbums = allAlbums.filter(album => !assignedAlbumIds.includes(parseInt(album.id)));
        
        if (!searchTerm) {
            setFilteredAlbums(availableAlbums);
        } else {
            const filtered = availableAlbums.filter(album =>
                album.title.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredAlbums(filtered);
        }
    }, [searchTerm, allAlbums, assignedAlbums]);

    const handleAlbumToggle = async (albumId) => {
        const isCurrentlyAssigned = assignedAlbums.some(album => parseInt(album.ID) === parseInt(albumId));
        
        setSaving(true);
        setError(null);
        setSaveMessage(null);

        try {
            if (isCurrentlyAssigned) {
                // Remove from album
                await window.wp.apiFetch({
                    path: `${config.restUrl}admin/galleries/${config.postId}/albums/${albumId}`,
                    method: 'DELETE',
                    headers: {
                        'X-WP-Nonce': config.nonce,
                    },
                });
                setAssignedAlbums(prev => prev.filter(album => parseInt(album.ID) !== parseInt(albumId)));
            } else {
                // Add to album
                console.log('Adding gallery to album:', { albumId, parsedId: parseInt(albumId), postId: config.postId });
                const requestData = { album_ids: [parseInt(albumId)] };
                console.log('Request data:', requestData);
                console.log('Full request path:', `${config.restUrl}admin/galleries/${config.postId}/albums`);
                
                try {
                    await window.wp.apiFetch({
                        path: `${config.restUrl}admin/galleries/${config.postId}/albums`,
                        method: 'POST',
                        data: requestData,
                    });
                    // Find the album object and add it to assigned albums
                    const albumToAdd = allAlbums.find(album => parseInt(album.id) === parseInt(albumId));
                    if (albumToAdd) {
                        setAssignedAlbums(prev => [...prev, {
                            ID: albumToAdd.id,
                            post_title: albumToAdd.title,
                            post_status: albumToAdd.status,
                            gallery_count: albumToAdd.gallery_count,
                            featured_image: albumToAdd.featured_image
                        }]);
                    }
                } catch (apiError) {
                    console.error('API Error details:', apiError);
                    console.error('Error message:', apiError.message);
                    console.error('Error code:', apiError.code);
                    console.error('Error data:', apiError.data);
                    throw apiError; // Re-throw to be caught by outer try-catch
                }
            }

            setSaveMessage(config.strings.saved);
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (err) {
            setError(err.message || 'Failed to update album assignment');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateNewAlbum = () => {
        // For now, just redirect to the new album page
        // In a future version, we could implement inline album creation
        window.location.href = 'post-new.php?post_type=fotogrids_album';
    };

    const getAssignedAlbumsData = () => {
        return assignedAlbums;
    };

    if (!config) {
        return React.createElement('div', { className: 'fotogrids-error' },
            React.createElement('p', null, error || 'Configuration not loaded')
        );
    }

    return React.createElement('div', { className: 'fotogrids-album-assignment' },
        // Assigned Albums Summary
        React.createElement('div', { className: 'fotogrids-assigned-summary' },
            React.createElement('p', null,
                React.createElement('strong', null,
                    `${config.strings.assignedTo} ${assignedAlbums.length} ${config.strings.albums}`
                )
            ),
            assignedAlbums.length > 0 && React.createElement('div', { className: 'fotogrids-assigned-list' },
                getAssignedAlbumsData().map(album =>
                    React.createElement('div', { key: album.ID, className: 'fotogrids-assigned-album' },
                        album.featured_image && React.createElement('img', {
                            src: album.featured_image,
                            alt: '',
                            className: 'fotogrids-assigned-album-thumb'
                        }),
                        React.createElement('div', { className: 'fotogrids-assigned-album-details' },
                            React.createElement('div', { className: 'fotogrids-assigned-album-title' }, album.post_title),
                            React.createElement('div', { className: 'fotogrids-assigned-album-meta' },
                                `${album.gallery_count || 0} galleries • ${album.post_status || 'draft'}`
                            )
                        ),
                        React.createElement('button', {
                            type: 'button',
                            className: 'fotogrids-remove-button',
                            onClick: () => handleAlbumToggle(album.ID),
                            disabled: saving,
                            title: 'Remove from album'
                        }, '×')
                    )
                )
            )
        ),

        // Search and Selection
        React.createElement('div', { className: 'fotogrids-album-search' },
            React.createElement('input', {
                type: 'text',
                placeholder: config.strings.searchPlaceholder,
                value: searchTerm,
                onChange: (e) => setSearchTerm(e.target.value),
                className: 'fotogrids-search-input'
            })
        ),

        // Album List
        React.createElement('div', { className: 'fotogrids-album-list' },
            filteredAlbums.length === 0 
                ? React.createElement('p', { className: 'fotogrids-no-albums' }, config.strings.noAlbumsFound)
                : React.createElement('div', { className: 'fotogrids-albums' },
                    filteredAlbums.map(album => {
                        return React.createElement('div', {
                            key: album.id,
                            className: 'fotogrids-album-item available'
                        },
                            album.featured_image && React.createElement('img', {
                                src: album.featured_image,
                                alt: '',
                                className: 'fotogrids-album-thumb'
                            }),
                            React.createElement('div', { className: 'fotogrids-album-details' },
                                React.createElement('div', { className: 'fotogrids-album-title' }, album.title),
                                React.createElement('div', { className: 'fotogrids-album-meta' },
                                    `${album.gallery_count || 0} galleries • ${album.status || 'draft'}`
                                )
                            ),
                            React.createElement('button', {
                                type: 'button',
                                className: 'fotogrids-add-button',
                                onClick: () => handleAlbumToggle(album.id),
                                disabled: saving,
                                title: 'Add to album'
                            }, '+')
                        );
                    })
                )
        ),

        // Create New Album Button
        React.createElement('div', { className: 'fotogrids-create-album' },
            React.createElement('button', {
                type: 'button',
                className: 'button button-secondary',
                onClick: handleCreateNewAlbum
            }, `+ ${config.strings.createNewAlbum}`)
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

export default AlbumAssignment;
