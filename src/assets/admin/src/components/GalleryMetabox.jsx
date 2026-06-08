/**
 * Gallery Items Metabox React Component
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ItemEditModal from './ItemEditModal.jsx';
import VideoEmbedModal from './VideoEmbedModal.jsx';
import Icon from './shared/Icon.jsx';
import { Confirm } from './shared/Modal';
import { Button } from './shared/Button';
import Checkbox from './shared/Checkbox';
import DangerZone from './shared/DangerZone.jsx';
import Tooltip from './Tooltip.jsx';
import GalleryPreview from './GalleryPreview.jsx';
import MediaUpload from './blocks/MediaUpload.jsx';

const GalleryMetabox = ({
    galleryItems = [],
    canEditPosts = true,
    ajaxUrl = '',
    nonce = '',
    strings = {}
}) => {

    // Add safety check
    if (!React || !useState || !useEffect || !useCallback) {
        console.error('React hooks not available');
        return React.createElement('div', {}, 'React hooks not available');
    }

    const uiState = window.FotoGridsUiState?.createNamespace({
        area: 'gallery-items',
        postId: window.fotogridsMetaBoxes?.postId || 0,
    });
    const TABS = ['manage', 'preview'];
    const [activeTab, setActiveTab] = useState(() => {
        if (!uiState) return 'manage';
        return uiState.getValue({ key: 'main-tab', fallback: 'manage', urlParam: 'fg-items-tab', allowed: TABS });
    });
    const [items, setItems] = useState(Array.isArray(galleryItems) ? galleryItems : []);
    const [showModal, setShowModal] = useState(false);
    const [showVideoEmbedModal, setShowVideoEmbedModal] = useState(false);
    const [editingEmbed, setEditingEmbed] = useState(null);
    const [showClearAllModal, setShowClearAllModal] = useState(false);
    const [clearAllConfirmValue, setClearAllConfirmValue] = useState('');
    const [clearAllDeleteCustomData, setClearAllDeleteCustomData] = useState(false);
    const [currentItemId, setCurrentItemId] = useState(null);
    const [currentItemData, setCurrentItemData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAddDropdown, setShowAddDropdown] = useState(false);
    const handleReorderItemsRef = useRef(null);
    const State = window.FotoGridsCollectionState;

    // Initialize items from props with safety check
    useEffect(() => {
        if (Array.isArray(galleryItems)) {
            // Ensure `featured` property exists for all items. The bootstrap
            // payload carries `featured: bool` reflecting the gallery's
            // native `_thumbnail_id`; default to false for any item missing
            // the field.
            const itemsWithFeatured = galleryItems.map(item => ({
                ...item,
                featured: item.featured || false
            }));

            setItems(itemsWithFeatured);

            // Initialize state manager with item IDs
            if (State) {
                const itemIds = itemsWithFeatured.map(item => String(item.id)).filter(Boolean);
                State.items.initItems(itemIds);
            }
        }
    }, [galleryItems]);

    // Initialize sortable functionality using HTML5 drag and drop
    useEffect(() => {
        const gridElement = document.getElementById('fotogrids-items-grid');

        if (!gridElement || items.length === 0) {
            return;
        }

        let draggedElement = null;
        let placeholder = null;
        let draggedIndex = -1;

        // All visual state for the dragging item and the placeholder lives in
        // CSS — see `.fotogrids-dragging` and `.fotogrids-item-placeholder`
        // in items.scss. Do NOT set inline styles here: when React re-renders
        // after a successful drop, it reuses DOM nodes by key and any
        // JS-applied inline `style.*` will outlive the drag (e.g. opacity
        // stuck at 0.7) because React doesn't manage those properties.
        const createPlaceholder = () => {
            const placeholderEl = document.createElement('div');
            placeholderEl.className = 'fotogrids-item-placeholder';
            placeholderEl.setAttribute('data-drop-text', strings.dropHere);
            return placeholderEl;
        };

        const getItemIndex = (element) => {
            const items = Array.from(gridElement.querySelectorAll('.fotogrids-item-item'));
            return items.indexOf(element);
        };

        // Defensive cleanup: removes the dragging class from every item.
        // Called from handleDragEnd AND directly after a drop, because some
        // browsers don't fire dragend when the source node is reparented
        // mid-drag (which our drop handler does).
        const clearDraggingState = () => {
            gridElement.querySelectorAll('.fotogrids-item-item.fotogrids-dragging')
                .forEach(el => el.classList.remove('fotogrids-dragging'));
            gridElement.classList.remove('fotogrids-sortable--dragging');
        };

        const handleDragStart = (e) => {
            draggedElement = e.currentTarget;
            draggedIndex = getItemIndex(draggedElement);
            draggedElement.classList.add('fotogrids-dragging');
            gridElement.classList.add('fotogrids-sortable--dragging');

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedElement.getAttribute('data-id'));

            // Create placeholder
            placeholder = createPlaceholder();
            draggedElement.parentNode.insertBefore(placeholder, draggedElement.nextSibling);
        };

        const handleDragEnd = (e) => {
            clearDraggingState();

            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.removeChild(placeholder);
            }

            draggedElement = null;
            placeholder = null;
            draggedIndex = -1;
        };

        const handleDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();

            e.dataTransfer.dropEffect = 'move';

            if (!draggedElement || draggedElement === e.currentTarget) {
                return;
            }

            const targetItem = e.currentTarget;
            const targetIndex = getItemIndex(targetItem);

            if (targetIndex === -1) {
                return;
            }

            // Remove placeholder if it exists
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.removeChild(placeholder);
            }

            // Insert placeholder at the correct position
            if (draggedIndex < targetIndex) {
                gridElement.insertBefore(placeholder, targetItem.nextSibling);
            } else {
                gridElement.insertBefore(placeholder, targetItem);
            }
        };

        const handleDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!draggedElement) {
                return false;
            }

            // Move the dragged element to wherever the placeholder currently
            // sits. The placeholder is kept in sync with the cursor by
            // handleDragOver, so this is the authoritative drop position —
            // we deliberately do NOT recompute from draggedIndex / targetIndex
            // because those snapshots get out of sync as the DOM mutates.
            if (placeholder && placeholder.parentNode === gridElement) {
                gridElement.insertBefore(draggedElement, placeholder);
                placeholder.parentNode.removeChild(placeholder);
            } else {
                // Fallback: no placeholder present (shouldn't normally happen).
                // Drop next to the hovered target based on the captured index.
                if (draggedElement === e.currentTarget) {
                    return false;
                }
                const targetItem = e.currentTarget;
                const targetIndex = getItemIndex(targetItem);
                if (targetIndex === -1 || draggedIndex === -1) {
                    return false;
                }
                if (draggedIndex < targetIndex) {
                    gridElement.insertBefore(draggedElement, targetItem.nextSibling);
                } else {
                    gridElement.insertBefore(draggedElement, targetItem);
                }
            }

            // Get the new order from the DOM after moving
            const itemElements = Array.from(gridElement.querySelectorAll('.fotogrids-item-item'));
            const newOrder = itemElements.map(item => item.getAttribute('data-id'));

            // Belt-and-braces: clear dragging classes here too. dragend
            // normally handles it, but reparenting the source node during
            // drop can suppress dragend on some browsers.
            clearDraggingState();

            // Update order using ref - this will update state and trigger re-render
            if (handleReorderItemsRef.current && newOrder.length > 0) {
                handleReorderItemsRef.current(newOrder);
            }

            return false;
        };

        // Add drag event listeners to all items
        const itemElements = gridElement.querySelectorAll('.fotogrids-item-item');
        itemElements.forEach(item => {
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
        });

        // Also add dragover and drop to the container to allow dropping anywhere
        const handleContainerDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
        };

        const handleContainerDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!draggedElement) {
                return;
            }

            // If the placeholder is in the DOM, drop the dragged element where
            // the placeholder is. This is the path that fires when the user
            // releases the mouse with the cursor over the placeholder itself
            // (rather than over another .fotogrids-item-item) — without this,
            // the item-level `drop` handler never runs and the reorder is lost.
            if (placeholder && placeholder.parentNode === gridElement) {
                gridElement.insertBefore(draggedElement, placeholder);
                placeholder.parentNode.removeChild(placeholder);

                const itemElementsAfter = Array.from(
                    gridElement.querySelectorAll('.fotogrids-item-item')
                );
                const newOrder = itemElementsAfter.map(item => item.getAttribute('data-id'));

                clearDraggingState();

                if (handleReorderItemsRef.current && newOrder.length > 0) {
                    handleReorderItemsRef.current(newOrder);
                }
            }
        };

        gridElement.addEventListener('dragover', handleContainerDragOver);
        gridElement.addEventListener('drop', handleContainerDrop);

        // Cleanup function
        return () => {
            itemElements.forEach(item => {
                item.removeEventListener('dragstart', handleDragStart);
                item.removeEventListener('dragend', handleDragEnd);
                item.removeEventListener('dragover', handleDragOver);
                item.removeEventListener('drop', handleDrop);
            });
            gridElement.removeEventListener('dragover', handleContainerDragOver);
            gridElement.removeEventListener('drop', handleContainerDrop);
        };
    }, [items, strings]); // Re-initialize when items change

    // Save the gallery's featured item via REST. Pass null to clear.
    const saveFeaturedItem = useCallback(async (itemId) => {
        const galleryId = window.fotogridsMetaBoxes?.postId;
        if (!galleryId) {
            return;
        }
        try {
            await window.wp.apiFetch({
                path: `/fotogrids/v1/gallery/${galleryId}/featured-item`,
                method: 'POST',
                data: { item_id: itemId == null ? null : itemId },
            });
            if (window.fotogridsToast) {
                window.fotogridsToast.success(itemId ? strings.featuredItemSet : strings.featuredItemCleared);
            }
        } catch (error) {
            if (window.fotogridsToast) {
                window.fotogridsToast.error(error?.message || strings.errorSavingFeatured);
            }
            console.error('Error saving featured item:', error);
        }
    }, [strings]);

    // Handle media uploader
    const openMediaUploader = useCallback(() => {
        if (typeof wp === 'undefined' || typeof wp.media === 'undefined') {
            alert(strings.mediaNotAvailable);
            return;
        }

        const mediaUploader = wp.media({
            title: strings.selectItems,
            button: { text: strings.addToGallery },
            multiple: true,
            library: { type: 'image' }
        });

        mediaUploader.on('select', () => {
            const attachments = mediaUploader.state().get('selection').toJSON();

            // New items are never auto-featured. The server-side resolver
            // (`Cover_Resolver::for_gallery()`) falls back to
            // the first valid item when nothing is explicitly chosen, so
            // the UI accurately reflects "the user hasn't picked one yet".
            const newItems = attachments.map(attachment => ({
                id: attachment.id,
                title: attachment.title || attachment.filename || 'Untitled',
                url: attachment.url,
                thumbnail: attachment.sizes?.thumbnail?.url || attachment.url,
                alt: attachment.alt || attachment.title || '',
                featured: false,
            }));

            // Add new items, avoiding duplicates
            setItems(prevItems => {
                const existingIds = new Set(prevItems.map(img => img.id));
                const uniqueNewItems = newItems.filter(img => !existingIds.has(img.id));
                const updatedItems = [...prevItems, ...uniqueNewItems];

                if (State) {
                    const itemIds = updatedItems.map(item => String(item.id)).filter(Boolean);
                    State.items.setItems(itemIds);
                }

                return updatedItems;
            });
        });

        mediaUploader.open();
    }, [strings]);

    const handleUploadComplete = useCallback(async (uploadedIds) => {
        if (!uploadedIds || uploadedIds.length === 0) return;

        const newItems = [];
        for (const id of uploadedIds) {
            try {
                const media = await wp.apiFetch({ path: `/wp/v2/media/${id}` });
                newItems.push({
                    id: media.id,
                    title: media.title?.rendered || media.slug || 'Untitled',
                    url: media.source_url,
                    thumbnail: media.media_details?.sizes?.thumbnail?.source_url || media.source_url,
                    alt: media.alt_text || '',
                    featured: false,
                });
            } catch (err) {
                console.warn('Failed to fetch media', id, err);
            }
        }

        if (newItems.length === 0) return;

        setItems(prevItems => {
            const existingIds = new Set(prevItems.map(img => img.id));
            const uniqueNewItems = newItems.filter(img => !existingIds.has(img.id));
            const updatedItems = [...prevItems, ...uniqueNewItems];

            if (State) {
                const itemIds = updatedItems.map(item => String(item.id)).filter(Boolean);
                State.items.setItems(itemIds);
            }

            return updatedItems;
        });
    }, []);

    // Click the star: if not featured, make this item the featured one.
    // If already featured, clear (so there's a real "remove" affordance —
    // the runtime resolver then falls back to first-valid-item).
    const setFeatured = useCallback(async (itemId) => {
        let nextItemId = null;
        setItems(prevItems => {
            const clickedItem = prevItems.find(item => item.id === itemId);
            const wasFeatured = !!clickedItem?.featured;
            nextItemId = wasFeatured ? null : itemId;

            return prevItems.map(item => ({
                ...item,
                featured: nextItemId !== null && item.id === nextItemId,
            }));
        });
        await saveFeaturedItem(nextItemId);
    }, [saveFeaturedItem]);

    /**
     * Delete a virtual embed item row via REST. Embeds are not part of the
     * gallery's post-meta item list, so they require an explicit delete.
     */
    const deleteEmbedItem = useCallback(async (embedId) => {
        const restBase  = window.wpApiSettings?.root || '/wp-json/';
        const restNonce = window.wpApiSettings?.nonce || '';

        try {
            const response = await fetch(
                `${restBase}fotogrids/v1/items/embed/${embedId}`,
                {
                    method:  'DELETE',
                    headers: { 'X-WP-Nonce': restNonce },
                }
            );
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || `HTTP ${response.status}`);
            }
        } catch (err) {
            console.error('[FotoGrids] Failed to delete video embed', err);
            if (window.fotogridsToast) {
                window.fotogridsToast.error(strings.videoEmbedRemoveFailed || 'Failed to remove the video.');
            }
        }
    }, [strings]);

    // Remove item. We never auto-promote a different item to featured —
    // the runtime resolver handles that fallback. We just clear the
    // explicit featured choice when the user removes the featured item.
    const removeItem = useCallback((itemId) => {
        let needsClear = false;
        let removedEmbed = null;
        setItems(prevItems => {
            const itemToRemove = prevItems.find(item => item.id === itemId);
            needsClear = !!itemToRemove?.featured;
            const itemType = itemToRemove?.item_type || 'image';
            if (itemType === 'video_youtube' || itemType === 'video_vimeo') {
                removedEmbed = itemToRemove;
            }
            const remainingItems = prevItems.filter(img => img.id !== itemId);

            // Embeds are not in the State manager's attachment list, so only
            // attachment-backed items are removed from it.
            if (State && !removedEmbed) {
                State.items.removeItem(String(itemId));
            }

            return remainingItems;
        });
        // Embeds persist as item_meta rows independent of gallery save, so
        // removing one from the grid must delete its row via REST.
        if (removedEmbed) {
            deleteEmbedItem(itemId);
        }
        if (needsClear) {
            saveFeaturedItem(null);
        }
    }, [saveFeaturedItem, deleteEmbedItem]);

    // Clear all items
    const closeClearAllModal = useCallback(() => {
        setShowClearAllModal(false);
        setClearAllConfirmValue('');
        setClearAllDeleteCustomData(false);
    }, []);

    const clearAllItems = useCallback(() => {
        setClearAllConfirmValue('');
        setClearAllDeleteCustomData(false);
        setShowClearAllModal(true);
    }, []);

    const confirmClearAllItems = useCallback(() => {
        setItems([]);
        // Clear the explicit featured choice when the gallery is emptied.
        saveFeaturedItem(null);
        if (State) {
            State.items.setItems([]);
        }
    }, [saveFeaturedItem]);

    // Handle item reordering.
    //
    // The reorder is treated as a regular gallery change: it updates the
    // shared state manager (which marks `items` as unsaved) and dispatches
    // the `fotogrids:setting_changed` event so ajax-save.js's autosave
    // pipeline handles persistence the same way it handles any other
    // change. If autosave is off, the user will see the "unsaved changes"
    // badge and can click Update; if it's on, the standard debounced
    // saveCollectionAjax() fires and produces the usual save toast.
    //
    // We deliberately don't hit the legacy `wp_ajax_fotogrids_reorder_gallery_items`
    // endpoint anymore — order is persisted by the standard save pipeline
    // (`fotogrids_save_collection` AJAX action) via the hidden
    // `fotogrids_gallery_items[]` inputs rendered for each item below.
    const handleReorderItems = useCallback((newOrder) => {
        // Reorder items in state to match new order using functional update
        setItems(prevItems => {
            const reorderedItems = newOrder.map(id =>
                prevItems.find(item => item.id.toString() === id.toString())
            ).filter(Boolean);

            // Update state manager — this fires the 'items' listener which
            // in turn sets `unsavedChanges.sources.items = true`.
            if (State) {
                const itemIds = reorderedItems.map(item => String(item.id)).filter(Boolean);
                State.items.reorderItems(itemIds);
            }

            return reorderedItems;
        });

        // Tell ajax-save.js a setting changed. This is the same channel
        // settings panels use, so it triggers the unsaved-changes badge
        // and the autosave debounce.
        document.dispatchEvent(new CustomEvent('fotogrids:setting_changed', {
            detail: { source: 'items-reorder' },
        }));
    }, []);

    // Update ref when handleReorderItems changes
    useEffect(() => {
        handleReorderItemsRef.current = handleReorderItems;
    }, [handleReorderItems]);

    // Open item edit modal
    // Load item data function (shared by openItemModal and navigateItem)
    const loadItemData = useCallback(async (itemId) => {
        setLoading(true);

        // Add delay to see loading state (for debugging)
        // await new Promise(resolve => setTimeout(resolve, 10000));

        try {
            const formData = new FormData();
            formData.append('action', 'fotogrids_get_item_data');
            formData.append('item_id', itemId);
            formData.append('nonce', nonce);

            const response = await fetch(ajaxUrl, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                setCurrentItemData(data.data);
                setCurrentItemId(itemId);
                return true;
            } else {
                alert(strings.errorLoadingItem);
                return false;
            }
        } catch (error) {
            console.error('Error loading item data:', error);
            alert(strings.errorLoadingItem);
            return false;
        } finally {
            setLoading(false);
        }
    }, [ajaxUrl, nonce, strings]);

    const openItemModal = useCallback(async (itemId) => {
        // Video embeds are virtual item_meta rows, not attachments, so the
        // attachment-only item-data endpoint can't load them. Route them to
        // the embed modal in edit mode instead of the standard item editor.
        const clicked = items.find(it => it.id === itemId);
        const itemType = clicked?.item_type || 'image';
        if (itemType === 'video_youtube' || itemType === 'video_vimeo') {
            setEditingEmbed(clicked);
            setShowVideoEmbedModal(true);
            return;
        }

        setShowModal(true);
        await loadItemData(itemId);
    }, [items, loadItemData]);

    // Navigate between items in modal
    const navigateItem = useCallback(async (direction) => {
        const currentIndex = items.findIndex(img => img.id === currentItemId);
        let nextIndex;

        if (direction === 'prev') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        } else {
            nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        }

        const nextItemId = items[nextIndex]?.id;
        if (nextItemId) {
            await loadItemData(nextItemId);
        }
    }, [items, currentItemId, loadItemData]);

    // Handle tab switching
    const handleTabSwitch = useCallback((tabId) => {
        setActiveTab(tabId);
        setShowAddDropdown(false);
        if (uiState) {
            uiState.setValue({ key: 'main-tab', value: tabId, urlParam: 'fg-items-tab' });
        }
    }, [uiState]);

    // Handle add dropdown
    const handleAddOption = useCallback((action) => {
        setShowAddDropdown(false);

        switch (action) {
            case 'upload':
            case 'library':
                openMediaUploader();
                break;
            case 'folder':
                alert('Browse uploads folder functionality will be implemented soon.');
                break;
            case 'zip':
                alert('ZIP upload functionality will be implemented soon.');
                break;
            case 'video_embed':
                setShowVideoEmbedModal(true);
                break;
            default:
                console.log('Unknown action:', action);
        }
    }, [openMediaUploader]);

    /**
     * Called by VideoEmbedModal when the user confirms.
     * POSTs to the REST endpoint to create a virtual item, then inserts
     * the returned item object into the grid.
     */
    const handleAddVideoEmbed = useCallback(async (embedForm) => {
        const restBase  = window.wpApiSettings?.root || '/wp-json/';
        const restNonce = window.wpApiSettings?.nonce || '';
        const galleryId = window.fotogridsMetaBoxes?.postId || '';

        // The modal carries a UI-facing source ('youtube' | 'vimeo'); the REST
        // endpoint expects the canonical item_type identifier
        // ('video_youtube' | 'video_vimeo'). Map it before sending so the
        // create_embed handler recognises the source.
        const canonicalSource = embedForm.source === 'vimeo'
            ? 'video_vimeo'
            : 'video_youtube';

        const response = await fetch(
            `${restBase}fotogrids/v1/items/embed`,
            {
                method:  'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce':   restNonce,
                },
                body: JSON.stringify({
                    gallery_id: galleryId,
                    ...embedForm,
                    source: canonicalSource,
                }),
            }
        );

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const msg = err.message || `HTTP ${response.status}`;
            if (window.fotogridsToast) {
                window.fotogridsToast.error(msg);
            }
            throw new Error(msg);
        }

        const data = await response.json();

        const newItem = {
            id:          data.id,
            item_type:   data.item_type,
            title:       data.caption || embedForm.caption || embedForm.title || 'Video',
            thumbnail:   data.thumbnail_url || '',
            alt:         embedForm.caption || '',
            featured:    false,
            source:      embedForm.source,
            // Full embed payload so re-opening the item prefills the edit modal.
            embed: {
                caption:       embedForm.caption || '',
                embed_url:     embedForm.url || '',
                video_id:      embedForm.videoId || '',
                thumbnail_url: data.thumbnail_url || '',
                settings:      data.custom_data || {},
            },
        };

        // Embeds are not part of the State manager's attachment list; appending
        // them locally keeps the grid in sync without touching that list.
        setItems(prevItems => [...prevItems, newItem]);

        if (window.fotogridsToast) {
            window.fotogridsToast.success(strings.videoEmbedAdded);
        }
    }, [strings]);

    /**
     * Called by VideoEmbedModal when editing an existing embed. PUTs to the
     * embed update endpoint and refreshes the item in the grid.
     */
    const handleUpdateVideoEmbed = useCallback(async (embedForm) => {
        const restBase  = window.wpApiSettings?.root || '/wp-json/';
        const restNonce = window.wpApiSettings?.nonce || '';
        const embedId   = embedForm.id;

        const canonicalSource = embedForm.source === 'vimeo'
            ? 'video_vimeo'
            : 'video_youtube';

        const response = await fetch(
            `${restBase}fotogrids/v1/items/embed/${embedId}`,
            {
                method:  'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce':   restNonce,
                },
                body: JSON.stringify({
                    ...embedForm,
                    source: canonicalSource,
                }),
            }
        );

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const msg = err.message || `HTTP ${response.status}`;
            if (window.fotogridsToast) {
                window.fotogridsToast.error(msg);
            }
            throw new Error(msg);
        }

        const data = await response.json();

        setItems(prevItems => prevItems.map(it => {
            if (it.id !== embedId) {
                return it;
            }
            return {
                ...it,
                item_type: data.item_type,
                title:     data.caption || 'Video',
                thumbnail: data.thumbnail_url || it.thumbnail,
                alt:       data.caption || '',
                source:    embedForm.source,
                embed: {
                    caption:       data.caption || '',
                    embed_url:     embedForm.url || '',
                    video_id:      (data.custom_data && data.custom_data.video_id) || '',
                    thumbnail_url: data.thumbnail_url || '',
                    settings:      data.custom_data || {},
                },
            };
        }));

        if (window.fotogridsToast) {
            window.fotogridsToast.success(strings.videoEmbedUpdated || strings.videoEmbedAdded);
        }
    }, [strings]);

    const renderItemsGrid = () => {
        if (items.length === 0) {
            const handleFromLibrary = () => openMediaUploader();
            const handleVideoEmbed = () => setShowVideoEmbedModal(true);
            const handleOtherSources = () => window.FotoGridsUpgrade?.launchForFeature?.integrations?.();

            return (
                <>
                    <p className="description">
                        {strings.noItems}
                    </p>
                    <div className="fotogrids-items-noitems-add fotogrids-noitems-add-grid">
                        <div className="fotogrids-noitems-add-block fotogrids-noitems-add-block--upload">
                            <MediaUpload onUploadComplete={handleUploadComplete} inputId="fotogrids-metabox-upload-input" />
                        </div>
                        <button
                            type="button"
                            className="fotogrids-noitems-add-block fotogrids-noitems-add-block--action"
                            onClick={handleFromLibrary}
                        >
                            <Icon name="folder" className="fotogrids-noitems-add-block__icon" />
                            <h4>{strings.addFromLibrary}</h4>
                            <p>{strings.fromLibraryDescription}</p>
                        </button>
                        <button
                            type="button"
                            className="fotogrids-noitems-add-block fotogrids-noitems-add-block--action"
                            onClick={handleVideoEmbed}
                        >
                            <div
                                className="fotogrids-noitems-add-block__icon"
                                dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.video }}
                            />
                            <h4>{strings.addVideoEmbed}</h4>
                            <p>{strings.addVideoEmbedDescription}</p>
                        </button>
                        <button
                            type="button"
                            className="fotogrids-noitems-add-block fotogrids-noitems-add-block--action"
                            onClick={handleOtherSources}
                        >
                            <div
                                className="fotogrids-noitems-add-block__icon"
                                dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.puzzle }}
                            />
                            <h4>{strings.fromOtherSources}</h4>
                            <p>{strings.fromOtherSourcesDescription}</p>
                        </button>
                    </div>
                </>
            );
        }

        return (
            <div id="fotogrids-items-grid" className="fotogrids-sortable">
                {items.map((item) => {
                    const itemType = typeof item.item_type === 'string' ? item.item_type : 'image';
                    const isVideo  = itemType.indexOf('video') === 0;

                    return (
                    <div
                        key={item.id}
                        className={`fotogrids-item-item${isVideo ? ' fotogrids-item-item--video' : ''}`}
                        data-id={item.id}
                        data-item-type={item.item_type || 'image'}
                        draggable="true"
                    >
                        {item.thumbnail ? (
                            <img
                                src={item.thumbnail}
                                alt={item.alt}
                                onClick={() => openItemModal(item.id)}
                                style={{ cursor: 'pointer' }}
                            />
                        ) : (
                            <div
                                className="fotogrids-item-thumb-placeholder"
                                onClick={() => openItemModal(item.id)}
                                style={{ cursor: 'pointer' }}
                                aria-label={item.alt || item.title}
                            />
                        )}
                        {isVideo && (
                            <span className="fotogrids-item-video-badge" aria-hidden="true">
                                <Icon name="play" />
                            </span>
                        )}
                        <div className={`fotogrids-item-featured ${item.featured ? 'is-featured' : ''}`}>
                            <Tooltip content={item.featured ? strings.clearFeatured : strings.setAsFeatured} position="top">
                                <button
                                    type="button"
                                    className="fotogrids-item-featured-button"
                                    onClick={() => setFeatured(item.id)}
                                    aria-pressed={!!item.featured}
                                    aria-label={item.featured ? strings.clearFeatured : strings.setAsFeatured}
                                >
                                    <Icon name="star" />
                                </button>
                            </Tooltip>
                        </div>
                        <div className="fotogrids-item-controls">
                            <Tooltip content={strings.editItem} position="top">
                                <button
                                    type="button"
                                    className="fotogrids-edit-item"
                                    onClick={() => openItemModal(item.id)}
                                    aria-label={strings.editItem}
                                >
                                    <Icon name="edit" />
                                </button>
                            </Tooltip>
                            <Tooltip content={strings.removeItem} position="top">
                                <button
                                    type="button"
                                    className="fotogrids-remove-item"
                                    onClick={() => removeItem(item.id)}
                                    aria-label={strings.removeItem}
                                >
                                    <Icon name="x" />
                                </button>
                            </Tooltip>
                        </div>
                        <div className="fotogrids-item-title">
                            {item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title}
                        </div>
                        <input
                            type="hidden"
                            name="fotogrids_gallery_items[]"
                            value={item.id}
                        />
                    </div>
                    );
                })}
            </div>
        );
    };

    const renderAddDropdown = () => (
        <div className="fotogrids-add-new-dropdown">
            <Button
                variant="primary"
                size="sm"
                className={`fotogrids-add-new-toggle ${showAddDropdown ? 'fotogrids-dropdown-open' : ''}`}
                onClick={() => setShowAddDropdown(!showAddDropdown)}
                icon="plus"
                iconRight="chevron_down"
            >
                {strings.addNew}
            </Button>
            {showAddDropdown && (
                <div className="fotogrids-add-new-menu fotogrids-dropdown-open">
                    <div className="fotogrids-add-option" onClick={() => handleAddOption('upload')}>
						{strings.upload}
                    </div>
                    <div className="fotogrids-add-option" onClick={() => handleAddOption('library')}>
						{strings.fromLibrary}
                    </div>
                    <div className="fotogrids-add-option" onClick={() => handleAddOption('folder')}>
						{strings.fromFolder}
                    </div>
                    <div className="fotogrids-add-option" onClick={() => handleAddOption('zip')}>
						{strings.fromZip}
                    </div>
                    <div className="fotogrids-add-option" onClick={() => handleAddOption('video_embed')}>
						{strings.videoEmbed}
                    </div>
                    <div className="fotogrids-add-option fotogrids-add-option--pro" onClick={() => handleAddOption('instagram')}>
						{strings.instagram}
						<span className="fotogrids-pro-badge">Pro</span>
                    </div>
                </div>
            )}
        </div>
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showAddDropdown && !event.target.closest('.fotogrids-add-new-dropdown')) {
                setShowAddDropdown(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showAddDropdown]);

    return (
        <div className="fotogrids-gallery-metabox">
            {/* Header with tabs and actions */}
            <div className="fotogrids-gallery-header">
                <div className="fotogrids-gallery-tabs">
                    <button
                        type="button"
                        className={`fotogrids-gallery-tab ${activeTab === 'manage' ? 'fotogrids-gallery-tab--active' : ''}`}
                        onClick={() => handleTabSwitch('manage')}
                    >
                        <span className="fotogrids-icon" data-icon="edit"></span>
                        {strings.manageItems}
                    </button>
                    <button
                        type="button"
                        className={`fotogrids-gallery-tab ${activeTab === 'preview' ? 'fotogrids-gallery-tab--active' : ''}`}
                        onClick={() => handleTabSwitch('preview')}
                    >
                        <span className="fotogrids-icon" data-icon="preview"></span>
                        {strings.previewGallery}
                    </button>
                </div>

                {activeTab === 'manage' && (
                    <div className="fotogrids-gallery-actions">
                        {renderAddDropdown()}
                        <Button
                            variant="secondary"
                            size="sm"
                            className="fotogrids-items-remove-all"
                            onClick={clearAllItems}
                        >
                            {strings.removeAll}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="fotogrids-items-bulk-editor"
                            onClick={() => {
                                if (window.FotoGridsUpgrade) {
                                    window.FotoGridsUpgrade.launchForFeature.bulkOperations();
                                }
                            }}
                        >
                            {strings.bulkEditor}
                            <span className="fotogrids-pro-badge">Pro</span>
                        </Button>
                    </div>
                )}
            </div>

            {/* Tab content */}
            <div className="fotogrids-gallery-content">
                <div className={`fotogrids-gallery-tab-content ${activeTab === 'manage' ? 'fotogrids-gallery-tab-content--active' : ''}`}>
                    <div id="fotogrids-items-container">
                        {renderItemsGrid()}
                    </div>
                </div>

                <div className={`fotogrids-gallery-tab-content ${activeTab === 'preview' ? 'fotogrids-gallery-tab-content--active' : ''}`}>
                    {activeTab === 'preview' && (
                        <GalleryPreview
                            items={items}
                            galleryId={window.fotogridsMetaBoxes?.postId || null}
                        />
                    )}
                </div>
            </div>

            {/* Item Edit Modal */}
            {showModal && (
                <ItemEditModal
                    itemId={currentItemId}
                    itemData={currentItemData}
                    loading={loading}
                    items={items}
                    onClose={() => setShowModal(false)}
                    onNavigate={navigateItem}
                    strings={strings}
                />
            )}

            {/* Video Embed Modal (add + edit) */}
            <VideoEmbedModal
                isOpen={showVideoEmbedModal}
                editItem={editingEmbed}
                onClose={() => { setShowVideoEmbedModal(false); setEditingEmbed(null); }}
                onAdd={handleAddVideoEmbed}
                onUpdate={handleUpdateVideoEmbed}
                strings={strings}
            />

            <Confirm
                isOpen={showClearAllModal}
                onClose={closeClearAllModal}
                onConfirm={confirmClearAllItems}
                variant="danger"
                headerIcon={false}
                title={strings.removeAllModalTitle}
                confirmLabel={strings.removeAllItems}
                cancelLabel={strings.cancel}
                requireText="REMOVE ALL"
            >
                <DangerZone
                    title={strings.removeAllModalWarning}
                    description={strings.removeAllModalBody}
                    icon="trash"
                />
                <Checkbox
                    checked={clearAllDeleteCustomData}
                    onChange={(next) => setClearAllDeleteCustomData(next)}
                    label={strings.removeAllModalDeleteCustomDataLabel}
                    labelStronger
                    description={strings.removeAllModalDeleteCustomDataHelp}
                />
                {/* <div className="fotogrids-notice fotogrids-notice--warning">
                </div> */}
            </Confirm>
        </div>
    );
};

export default GalleryMetabox;
