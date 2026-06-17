import React, { useState, useEffect } from 'react';
import Tooltip from './Tooltip';
import Icon from './shared/Icon';

const AlbumGalleries = () => {
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [assignedGalleries, setAssignedGalleries] = useState([]);
    const [allGalleries, setAllGalleries] = useState([]);
    const [availableGalleries, setAvailableGalleries] = useState([]);
    const [saving, setSaving] = useState(false);
    const [featuredGalleryId, setFeaturedGalleryId] = useState(null);
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverState, setDragOverState] = useState(null); // { index, position: 'before'|'after' }

    const config = window.fotogridsAlbumGalleries;

    // Normalize gallery for unified rendering (assigned uses ID/post_title, available uses id/title)
    const normalizeGallery = (gallery) => ({
        id: gallery.ID ?? gallery.id,
        title: gallery.post_title ?? gallery.title,
        item_count: gallery.item_count,
        layout: gallery.layout,
        status: gallery.status_display ?? gallery.post_status ?? gallery.status ?? 'Draft',
        featured_item: gallery.featured_item,
        sample_items: gallery.sample_items,
        permalink: gallery.permalink ?? `${window.location.origin}/?p=${gallery.ID ?? gallery.id}`,
    });

    const renderGalleryItem = (gallery, variant, actionButton, index) => {
        const g = normalizeGallery(gallery);
        const isAssigned = variant === 'assigned';
        const isFeatured = isAssigned && featuredGalleryId === g.id;
        const featuredTooltip = isFeatured ? config.strings.clearFeatured : config.strings.setAsFeatured;
        const actionButtonTooltip = React.isValidElement(actionButton)
            ? actionButton.props?.title || actionButton.props?.['aria-label']
            : '';

        const thumbContent = g.sample_items && g.sample_items.length > 0
            ? g.sample_items.slice(0, 4).map((itemUrl, i) => (
                <div
                    key={i}
                    className={`fotogrids-gallery-thumb fgg-stack-${i}`}
                    style={{ backgroundImage: `url(${itemUrl})` }}
                />
            ))
            : g.featured_item ? (
                <div
                    className="fotogrids-gallery-thumb"
                    style={{ backgroundImage: `url(${g.featured_item})` }}
                />
            ) : (
                <div className="fotogrids-gallery-thumb">
                    <Icon name="image_x" />
                </div>
            );

        const isDragOver = isAssigned && draggedItem && dragOverState?.index === index && draggedItem.ID !== gallery.ID;
        const isDragging = isAssigned && draggedItem && draggedItem.ID === gallery.ID;
        const dragOverPosition = isDragOver ? dragOverState.position : null;
        const itemProps = {
            className: `fotogrids-gallery-item fotogrids-gallery-item--${variant}${isFeatured ? ' fotogrids-gallery-item--featured' : ''}${isDragOver ? ` fotogrids-drag-over fotogrids-drag-over--${dragOverPosition}` : ''}${isDragging ? ' fotogrids-gallery-item--dragging' : ''}`,
            ...(isDragOver && { 'data-drop-text': config.strings.dropItemHere }),
        };
        if (isAssigned) {
            itemProps.draggable = true;
            itemProps.onDragStart = (e) => handleDragStart(e, gallery);
            itemProps.onDragOver = (e) => handleDragOver(e, index);
            itemProps.onDragEnd = handleDragEnd;
            itemProps.onDrop = (e) => handleDrop(e, gallery);
        }

        return (
            <div key={g.id} {...itemProps}>
                <div className="fotogrids-gallery-item__content">
                    {isAssigned && <div className="fotogrids-gallery-drag">⋮⋮</div>}
                    <div className="fotogrids-gallery-items">{thumbContent}</div>
                    <div className="fotogrids-gallery-details">
                        <strong className={`fotogrids-gallery-title ${g.title ? '' : 'fotogrids-text--error'}`}>{g.title || config.strings.galleryTitleMissing}</strong>
                        <span className="fotogrids-gallery-meta">
                            <span className={`fotogrids-gallery-meta__item fotogrids-gallery-meta__count ${g.item_count === 0 ? 'fotogrids-text--error' : ''}`}>{g.item_count === 0 ? config.strings.noItems : `${g.item_count} ${config.strings.items}`}</span>
                            <span className="fotogrids-gallery-meta__item fotogrids-gallery-meta__status">{g.status}</span>
                            <span className={`fotogrids-gallery-meta__item fotogrids-gallery-meta__layout fotogrids-layout-badge layout-${g.layout}`}>{g.layout?.replace(/-/g, ' ') ?? g.layout}</span>
                        </span>
                    </div>
                    <div className="fotogrids-gallery-actions">
                        {isAssigned && (
                            <Tooltip content={featuredTooltip} position="top">
                                <button
                                    type="button"
                                    className={`fg-action-button fotogrids-featured-button${isFeatured ? ' is-featured' : ''}`}
                                    onClick={() => handleSetFeaturedGallery(g.id)}
                                    disabled={saving}
                                    title={featuredTooltip}
                                    aria-pressed={!!isFeatured}
                                    aria-label={featuredTooltip}
                                >
                                    <Icon name="star" />
                                </button>
                            </Tooltip>
                        )}
                        <Tooltip content={config.strings.viewGallery} position="top">
                            <a
                                href={g.permalink}
                                className="fg-action-button fg-action-button--view"
                                title={config.strings.viewGallery}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Icon name="preview" />
                            </a>
                        </Tooltip>
                        <Tooltip content={config.strings.editGallery} position="top">
                            <a
                                href={`${window.location.origin}/wp-admin/post.php?post=${g.id}&action=edit`}
                                className="fg-action-button fg-action-button--edit"
                                title={config.strings.editGallery}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Icon name="edit" />
                            </a>
                        </Tooltip>
                        {actionButtonTooltip ? (
                            <Tooltip content={actionButtonTooltip} position="top">
                                {actionButton}
                            </Tooltip>
                        ) : actionButton}
                    </div>
                </div>
            </div>
        );
    };

    useEffect(() => {
        if (config) {
            setAssignedGalleries(config.assignedGalleries || []);
            setAllGalleries(config.allGalleries || []);
            setFeaturedGalleryId(config.featuredGalleryId ?? null);
        }
    }, []);

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

            const galleryToAdd = allGalleries.find(g => g.id === galleryId);
            if (galleryToAdd) {
                const newAssignedGallery = {
                    ID: galleryToAdd.id,
                    post_title: galleryToAdd.title,
                    item_count: galleryToAdd.item_count,
                    layout: galleryToAdd.layout,
                    featured_item: galleryToAdd.featured_item,
                    sample_items: galleryToAdd.sample_items,
                    status_display: galleryToAdd.status_display,
                    position: assignedGalleries.length,
                };
                setAssignedGalleries(prev => [...prev, newAssignedGallery]);
                setAvailableGalleries(prev => prev.filter(g => g.id !== galleryId));
            }

            if (window.fotogridsToast) {
                window.fotogridsToast.success(config.strings.saved, 1000);
            }
            if (window.FotoGridsAjaxSave?.updateLastSavedTime) {
                window.FotoGridsAjaxSave.updateLastSavedTime();
            }
        } catch (err) {
            if (window.fotogridsToast) {
                window.fotogridsToast.error(err.message || config.strings.error, 3000);
            }
        } finally {
            setSaving(false);
        }
    };

    // Set or clear the album's featured gallery. Passing null clears the
    // explicit choice - the runtime resolver then falls back to the first
    // child gallery with a resolvable cover.
    const handleSetFeaturedGallery = async (galleryId) => {
        const wasFeatured = featuredGalleryId === galleryId;
        const nextId = wasFeatured ? null : galleryId;
        setSaving(true);

        try {
            await window.wp.apiFetch({
                path: `${config.restUrl}album/${config.postId}/featured-gallery`,
                method: 'POST',
                headers: {
                    'X-WP-Nonce': config.nonce,
                },
                data: { gallery_id: nextId },
            });

            setFeaturedGalleryId(nextId);

            if (window.fotogridsToast) {
                window.fotogridsToast.success(
                    nextId ? config.strings.featuredGallerySet : config.strings.featuredGalleryCleared,
                    1500
                );
            }
        } catch (err) {
            if (window.fotogridsToast) {
                window.fotogridsToast.error(err?.message || config.strings.errorSavingFeatured, 3000);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveGallery = async (galleryId) => {
        setSaving(true);

        try {
            await window.wp.apiFetch({
                path: `${config.restUrl}admin/albums/${config.postId}/galleries/${galleryId}`,
                method: 'DELETE',
                headers: {
                    'X-WP-Nonce': config.nonce,
                },
            });

            const galleryToRemove = assignedGalleries.find(g => g.ID === galleryId);
            if (galleryToRemove) {
                const availableGallery = {
                    id: galleryToRemove.ID,
                    title: galleryToRemove.post_title,
                    item_count: galleryToRemove.item_count,
                    layout: galleryToRemove.layout,
                    featured_item: galleryToRemove.featured_item,
                    status: 'publish',
                };
                setAvailableGalleries(prev => [...prev, availableGallery]);
                setAssignedGalleries(prev => prev.filter(g => g.ID !== galleryId));
            }

            // If the removed gallery was the explicit featured choice, drop
            // it locally - server-side the cover resolver will fall back to
            // the next valid child the next time it's read. We don't fire
            // the REST clear endpoint because the post meta still pointing
            // at a now-unassigned gallery is harmless (resolver ignores it).
            if (featuredGalleryId === galleryId) {
                setFeaturedGalleryId(null);
            }

            if (window.fotogridsToast) {
                window.fotogridsToast.success(config.strings.saved, 1000);
            }
            if (window.FotoGridsAjaxSave?.updateLastSavedTime) {
                window.FotoGridsAjaxSave.updateLastSavedTime();
            }
        } catch (err) {
            if (window.fotogridsToast) {
                window.fotogridsToast.error(err.message || config.strings.error, 3000);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleReorderGalleries = async (newOrder) => {
        setSaving(true);

        try {
            const galleryIds = newOrder.map(g => g.ID);
            await window.wp.apiFetch({
                path: `${config.restUrl}admin/albums/${config.postId}/galleries/reorder`,
                method: 'POST',
                headers: {
                    'X-WP-Nonce': config.nonce,
                },
                data: {
                    gallery_ids: galleryIds,
                },
            });

            setAssignedGalleries(newOrder);

            if (window.fotogridsToast) {
                window.fotogridsToast.success(config.strings.saved, 1000);
            }
            if (window.FotoGridsAjaxSave?.updateLastSavedTime) {
                window.FotoGridsAjaxSave.updateLastSavedTime();
            }
        } catch (err) {
            if (window.fotogridsToast) {
                window.fotogridsToast.error(err.message || config.strings.error, 3000);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDragStart = (e, gallery) => {
        setDraggedItem(gallery);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        setDragOverState({ index, position });
    };

    const handleDrop = (e, targetGallery) => {
        e.preventDefault();
        setDragOverState(null);
        if (!draggedItem || draggedItem.ID === targetGallery.ID) return;

        const currentIndex = assignedGalleries.findIndex(g => g.ID === draggedItem.ID);
        const hoverIndex = assignedGalleries.findIndex(g => g.ID === targetGallery.ID);
        const targetIndex = dragOverState?.index === hoverIndex && dragOverState?.position === 'after'
            ? hoverIndex + 1
            : hoverIndex;

        const newOrder = [...assignedGalleries];
        newOrder.splice(currentIndex, 1);
        newOrder.splice(targetIndex, 0, draggedItem);

        handleReorderGalleries(newOrder);
        setDraggedItem(null);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDragOverState(null);
    };

    if (!config) {
        return (
            <div className="fotogrids-error">
                <p>Configuration not loaded</p>
            </div>
        );
    }

    return (
        <div className="fotogrids-album-galleries">
            {/* Assigned Galleries Section */}
            <div className="fotogrids-assigned-section">
                <h4>{config.strings.assignedGalleries} ({assignedGalleries.length})</h4>

                {assignedGalleries.length === 0 ? (
                    <p className="fotogrids-no-galleries">{config.strings.noGalleriesAssigned}</p>
                ) : (
                    <div className="fotogrids-assigned-galleries">
                        <p className="fotogrids-drag-hint">{config.strings.dragToReorder}</p>
                        {assignedGalleries.map((gallery, index) =>
                            renderGalleryItem(gallery, 'assigned',
                                    <button
                                        type="button"
                                        className="fg-action-button fg-action-button--remove"
                                        onClick={() => handleRemoveGallery(gallery.ID)}
                                        disabled={saving}
                                        title={config.strings.removeFromAlbum}
                                    >
                                        <Icon name="x" />
                                    </button>,
                                    index
                            )
                        )}
                    </div>
                )}
            </div>

            {/* Available Galleries Section */}
            <div className="fotogrids-available-section">
                <h4>{config.strings.availableGalleries}</h4>

                <div className="fotogrids-gallery-search">
                    <input
                        type="text"
                        placeholder={config.strings.searchPlaceholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="fotogrids-search-input"
                    />
                </div>

                <div className="fotogrids-available-galleries">
                    {filteredAvailableGalleries.length === 0 ? (
                        <p className="fotogrids-no-galleries">{config.strings.noGalleriesAvailable}</p>
                    ) : (
                        filteredAvailableGalleries.map((gallery) =>
                            renderGalleryItem(gallery, 'available',
                                <button
                                    type="button"
                                    className="fg-action-button fg-action-button--add"
                                    onClick={() => handleAddGallery(gallery.id)}
                                    disabled={saving}
                                    title={config.strings.addToAlbum}
                                >
                                    <Icon name="plus" />
                                </button>
                            )
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default AlbumGalleries;
