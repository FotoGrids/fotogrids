import React, { useState, useEffect, useMemo } from 'react';

const FotoGridsIcons = window.FotoGridsIcons || {};
const AlbumAssignment = () => {
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [assignedAlbums, setAssignedAlbums] = useState([]);
    const [allAlbums, setAllAlbums] = useState([]);
    const [saving, setSaving] = useState(false);

    const config = window.fotogridsAlbumAssignment;

    useEffect(() => {
        if (config) {
            setAssignedAlbums(config.assignedAlbums || []);
            setAllAlbums(config.allAlbums || []);
        }
    }, []);

    // Derive available albums during render - avoids useEffect sync and two-phase updates
    // that were causing removeChild errors when item moved from available to assigned
    const availableAlbums = useMemo(() => {
        const assignedAlbumIds = assignedAlbums.map(album => parseInt(album.ID));
        return allAlbums.filter(album => !assignedAlbumIds.includes(parseInt(album.id)));
    }, [allAlbums, assignedAlbums]);

    const filteredAlbums = useMemo(() => {
        if (!searchTerm) return availableAlbums;
        return availableAlbums.filter(album =>
            album.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, availableAlbums]);

    const handleAlbumToggle = async (albumId) => {
        const isCurrentlyAssigned = assignedAlbums.some(album => parseInt(album.ID) === parseInt(albumId));

        setSaving(true);

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

                // Update the gallery count in allAlbums for the removed album
                setAllAlbums(prev => prev.map(album =>
                    parseInt(album.id) === parseInt(albumId)
                        ? { ...album, gallery_count: Math.max(0, (album.gallery_count || 0) - 1) }
                        : album
                ));
            } else {
                // Add to album
                const requestData = { album_ids: [parseInt(albumId)] };
                await window.wp.apiFetch({
                    path: `${config.restUrl}admin/galleries/${config.postId}/albums`,
                    method: 'POST',
                    data: requestData,
                });
                const albumToAdd = allAlbums.find(album => parseInt(album.id) === parseInt(albumId));
                if (albumToAdd) {
                    const updatedGalleryCount = (albumToAdd.gallery_count || 0) + 1;
                    setAssignedAlbums(prev => [...prev, {
                        ID: albumToAdd.id,
                        post_title: albumToAdd.title,
                        post_status: albumToAdd.status,
                        status_display: albumToAdd.status_display,
                        gallery_count: updatedGalleryCount,
                        featured_item: albumToAdd.featured_item
                    }]);

                    setAllAlbums(prev => prev.map(album =>
                        parseInt(album.id) === parseInt(albumId)
                            ? { ...album, gallery_count: updatedGalleryCount }
                            : album
                    ));
                }
            }

            if (window.fotogridsToast) {
                window.fotogridsToast.success(config.strings.saved, 1000);
            }
            if (window.FotoGridsAjaxSave?.updateLastSavedTime) {
                window.FotoGridsAjaxSave.updateLastSavedTime();
            }
        } catch (err) {
            if (window.fotogridsToast) {
                window.fotogridsToast.error(err.message || 'Failed to update album assignment', 3000);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleCreateNewAlbum = () => {
        // For now, just redirect to the new album page
        // In a future version, we could implement inline album creation
        window.open('post-new.php?post_type=fotogrids_album', '_blank');
    };

    const getAssignedAlbumsData = () => {
        return assignedAlbums;
    };

    if (!config) {
        return React.createElement('div', { className: 'fotogrids-error' },
            React.createElement('p', null, 'Configuration not loaded')
        );
    }

    return React.createElement('div', { className: 'fotogrids-album-assignment' },
        // Assigned Albums Summary
        React.createElement('div', { className: 'fotogrids-assigned-summary' },
            React.createElement('p', null,
                assignedAlbums.length === 0
                    ? `${config.strings.notAssignedTo} ${config.strings.albums}`
                    : `${config.strings.assignedTo} ${assignedAlbums.length} ${config.strings.albums}`
            ),
            assignedAlbums.length > 0 && React.createElement('div', { className: 'fotogrids-assigned-list' },
                getAssignedAlbumsData().map(album =>
                    React.createElement('div', { key: album.ID, className: 'fotogrids-assigned-album' },
                        React.createElement('div', { key: 'thumb', className: 'fotogrids-assigned-album-thumb-wrap' },
                            album.featured_item
                                ? React.createElement('img', {
                                    src: album.featured_item,
                                    alt: '',
                                    className: 'fotogrids-assigned-album-thumb'
                                })
                                : null
                        ),
                        React.createElement('div', { key: 'details', className: 'fotogrids-assigned-album-details' },
                            React.createElement('div', { className: 'fotogrids-assigned-album-title' }, album.post_title),
                            React.createElement('div', { className: 'fotogrids-assigned-album-meta' },
                                `${album.gallery_count || 0} galleries • ${album.status_display || 'Draft'}`
                            )
                        ),
                        React.createElement('button', {
                            key: 'action',
                            type: 'button',
                            className: 'fotogrids-action-button fotogrids-remove-button',
                            onClick: () => handleAlbumToggle(album.ID),
                            disabled: saving,
                            title: 'Remove from album'
                        },
                            React.createElement('span', {
                                className: 'fotogrids-icon',
                                dangerouslySetInnerHTML: { __html: FotoGridsIcons['x'] || '' }
                            })
                        )
                    )
                )
            )
        ),

        // Search and Selection
        availableAlbums.length > 0 && React.createElement('div', { className: 'fotogrids-album-search' },
            React.createElement('div', { className: 'fotogrids-search-input-wrapper' },
                React.createElement('div', {
                    className: 'fotogrids-search-icon',
                    dangerouslySetInnerHTML: { __html: FotoGridsIcons['search_md'] || '' }
                }),
                React.createElement('input', {
                    type: 'text',
                    placeholder: config.strings.searchPlaceholder,
                    value: searchTerm,
                    onChange: (e) => setSearchTerm(e.target.value),
                    className: 'fotogrids-search-input'
                })
            )
        ),

        // Album List
        React.createElement('div', { className: 'fotogrids-album-list' },
            filteredAlbums.length === 0
                ? React.createElement(
                    'p',
                    { className: 'fotogrids-no-albums' },
                    assignedAlbums.length > 0 && availableAlbums.length === 0
                        ? config.strings.noMoreAlbumsFound
                        : config.strings.noAvailableAlbumsFound
                )
                : React.createElement('div', { className: 'fotogrids-albums' },
                    filteredAlbums.map(album =>
                        React.createElement('div', {
                            key: album.id,
                            className: 'fotogrids-album-item available'
                        },
                            React.createElement('div', { key: 'thumb', className: 'fotogrids-album-thumb-wrap' },
                                album.featured_item
                                    ? React.createElement('img', {
                                        src: album.featured_item,
                                        alt: '',
                                        className: 'fotogrids-album-thumb'
                                    })
                                    : null
                            ),
                            React.createElement('div', { key: 'details', className: 'fotogrids-album-details' },
                                React.createElement('div', { className: 'fotogrids-album-title' }, album.title),
                                React.createElement('div', { className: 'fotogrids-album-meta' },
                                    `${album.gallery_count || 0} galleries • ${album.status_display || 'Draft'}`
                                )
                            ),
                            React.createElement('button', {
                                key: 'action',
                                type: 'button',
                                className: 'fotogrids-action-button fotogrids-add-button',
                                onClick: () => handleAlbumToggle(album.id),
                                disabled: saving,
                                title: 'Add to album'
                            },
                                React.createElement('span', {
                                    className: 'fotogrids-icon',
                                    dangerouslySetInnerHTML: { __html: FotoGridsIcons['plus'] || '' }
                                })
                            )
                        )
                    )
                )
        ),

        // Create New Album Button
        React.createElement('div', { className: 'fotogrids-create-album' },
            React.createElement('button', {
                type: 'button',
                className: 'fotogrids-button fotogrids-button--outline fotogrids-button--primary fotogrids-button--smaller',
                onClick: handleCreateNewAlbum
            },
                React.createElement('span', {
                    className: 'fotogrids-icon',
                    dangerouslySetInnerHTML: { __html: FotoGridsIcons['plus_square'] || '' }
                }),
                ` ${config.strings.createNewAlbum}`
            )
        )
    );
};

export default AlbumAssignment;
