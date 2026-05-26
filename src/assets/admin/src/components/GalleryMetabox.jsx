/**
 * Gallery Items Metabox React Component
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ItemEditModal from './ItemEditModal.jsx';
import VideoEmbedModal from './VideoEmbedModal.jsx';
import Icon from './shared/Icon.jsx';
import Modal from './shared/Modal.jsx';
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
            // Ensure favorite property exists for all items
            const itemsWithFavorite = galleryItems.map(item => ({
                ...item,
                favorite: item.favorite || false
            }));

            setItems(itemsWithFavorite);

            // Initialize state manager with item IDs
            if (State) {
                const itemIds = itemsWithFavorite.map(item => String(item.id)).filter(Boolean);
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

        const createPlaceholder = () => {
            const placeholderEl = document.createElement('div');
            placeholderEl.className = 'fotogrids-item-placeholder';
            placeholderEl.setAttribute('data-drop-text', strings.dropHere);
            placeholderEl.style.opacity = '0.5';
            placeholderEl.style.border = '2px dashed var(--fg-blue)';
            placeholderEl.style.borderRadius = '4px';
            placeholderEl.style.minHeight = '100px';
            return placeholderEl;
        };

        const getItemIndex = (element) => {
            const items = Array.from(gridElement.querySelectorAll('.fotogrids-item-item'));
            return items.indexOf(element);
        };

        const handleDragStart = (e) => {
            draggedElement = e.currentTarget;
            draggedIndex = getItemIndex(draggedElement);
            draggedElement.style.opacity = '0.7';
            draggedElement.style.cursor = 'move';

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedElement.getAttribute('data-id'));

            // Create placeholder
            placeholder = createPlaceholder();
            draggedElement.parentNode.insertBefore(placeholder, draggedElement.nextSibling);
        };

        const handleDragEnd = (e) => {
            if (draggedElement) {
                draggedElement.style.opacity = '';
                draggedElement.style.cursor = '';
            }

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

            // If dropping on the same element, do nothing
            if (draggedElement === e.currentTarget) {
                return false;
            }

            const targetItem = e.currentTarget;
            const targetIndex = getItemIndex(targetItem);

            if (targetIndex === -1 || draggedIndex === -1) {
                return false;
            }

            // Remove placeholder
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.removeChild(placeholder);
            }

            // Move the element in the DOM
            if (draggedIndex < targetIndex) {
                gridElement.insertBefore(draggedElement, targetItem.nextSibling);
            } else {
                gridElement.insertBefore(draggedElement, targetItem);
            }

            // Get the new order from the DOM after moving
            const itemElements = Array.from(gridElement.querySelectorAll('.fotogrids-item-item'));
            const newOrder = itemElements.map(item => item.getAttribute('data-id'));

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

    // Save favorite item to database
    const saveFavoriteItem = useCallback(async (itemId) => {
        try {
            const formData = new FormData();
            formData.append('action', 'fotogrids_set_favorite_item');
            formData.append('gallery_id', window.fotogridsMetaBoxes?.postId || '');
            formData.append('item_id', itemId || '');
            formData.append('nonce', nonce);

            const response = await fetch(ajaxUrl, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                if (window.fotogridsToast) {
                    const message = data.data?.message || (itemId ? strings.favoriteItemSet : strings.favoriteItemRemoved);
                    window.fotogridsToast.success(message);
                }
            } else {
                if (window.fotogridsToast) {
                    const message = data.data?.message;
                    window.fotogridsToast.error(message);
                }
                console.error('Failed to save favorite item:', data.data);
            }
        } catch (error) {
            if (window.fotogridsToast) {
                window.fotogridsToast.error(strings.errorSavingFavorite);
            }
            console.error('Error saving favorite item:', error);
        }
    }, [ajaxUrl, nonce]);

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

            const newItems = attachments.map(attachment => ({
                id: attachment.id,
                title: attachment.title || attachment.filename || 'Untitled',
                url: attachment.url,
                thumbnail: attachment.sizes?.thumbnail?.url || attachment.url,
                alt: attachment.alt || attachment.title || '',
                favorite: false
            }));

            // Add new items, avoiding duplicates
            setItems(prevItems => {
                const existingIds = new Set(prevItems.map(img => img.id));
                const uniqueNewItems = newItems.filter(img => !existingIds.has(img.id));
                const wasEmpty = prevItems.length === 0;
                const updatedItems = [...prevItems, ...uniqueNewItems];

                if (wasEmpty && uniqueNewItems.length > 0) {
                    updatedItems.forEach(item => {
                        item.favorite = item.id === uniqueNewItems[0].id;
                    });

                    if (uniqueNewItems[0].id) {
                        saveFavoriteItem(uniqueNewItems[0].id);
                    }
                }

                // Update state manager
                if (State) {
                    const itemIds = updatedItems.map(item => String(item.id)).filter(Boolean);
                    State.items.setItems(itemIds);
                }

                return updatedItems;
            });
        });

        mediaUploader.open();
    }, [strings, saveFavoriteItem]);

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
                    favorite: false
                });
            } catch (err) {
                console.warn('Failed to fetch media', id, err);
            }
        }

        if (newItems.length === 0) return;

        setItems(prevItems => {
            const existingIds = new Set(prevItems.map(img => img.id));
            const uniqueNewItems = newItems.filter(img => !existingIds.has(img.id));
            const wasEmpty = prevItems.length === 0;
            const updatedItems = [...prevItems, ...uniqueNewItems];

            if (wasEmpty && uniqueNewItems.length > 0) {
                updatedItems.forEach(item => {
                    item.favorite = item.id === uniqueNewItems[0].id;
                });
                if (uniqueNewItems[0].id) {
                    saveFavoriteItem(uniqueNewItems[0].id);
                }
            }

            if (State) {
                const itemIds = updatedItems.map(item => String(item.id)).filter(Boolean);
                State.items.setItems(itemIds);
            }

            return updatedItems;
        });
    }, [saveFavoriteItem]);

    const toggleFavorite = useCallback(async (itemId) => {
        setItems(prevItems => {
            const clickedItem = prevItems.find(item => item.id === itemId);
            const wasFavorite = clickedItem?.favorite;

            // If clicking on the item that's already the favorite, do nothing
            if (wasFavorite) {
                return prevItems; // No changes
            }

            // Set the clicked item as favorite and unset the previous favorite
            const updatedItems = prevItems.map(item => ({
                ...item,
                favorite: item.id === itemId
            }));

            // Save new favorite to database
            saveFavoriteItem(itemId);

            return updatedItems;
        });
    }, [saveFavoriteItem]);

    // Remove item
    const removeItem = useCallback((itemId) => {
        setItems(prevItems => {
            const itemToRemove = prevItems.find(item => item.id === itemId);
            const wasFavorite = itemToRemove?.favorite;
            const remainingItems = prevItems.filter(img => img.id !== itemId);

            // If favorite item was deleted, make first remaining item favorite
            if (wasFavorite && remainingItems.length > 0) {
                remainingItems.forEach((item, index) => {
                    item.favorite = index === 0;
                });
                // Save new favorite to database
                if (remainingItems[0].id) {
                    saveFavoriteItem(remainingItems[0].id);
                }
            } else if (remainingItems.length === 0) {
                // No items left, clear favorite
                saveFavoriteItem(null);
            }

            // Update state manager
            if (State) {
                State.items.removeItem(String(itemId));
            }

            return remainingItems;
        });
    }, [saveFavoriteItem]);

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
        if (clearAllConfirmValue !== 'REMOVE ALL') {
            return;
        }
        setItems([]);
        closeClearAllModal();
        // Clear favorite when all items are removed
        saveFavoriteItem(null);

        // Update state manager
        if (State) {
            State.items.setItems([]);
        }
    }, [clearAllConfirmValue, closeClearAllModal, saveFavoriteItem]);

    // Handle item reordering
    const handleReorderItems = useCallback(async (newOrder) => {
        try {
            // Reorder items in state to match new order using functional update
            setItems(prevItems => {
                const reorderedItems = newOrder.map(id =>
                    prevItems.find(item => item.id.toString() === id.toString())
                ).filter(Boolean);

                // Update state manager
                if (State) {
                    const itemIds = reorderedItems.map(item => String(item.id)).filter(Boolean);
                    State.items.reorderItems(itemIds);
                }

                return reorderedItems;
            });

            // Save new order to server
            const formData = new FormData();
            formData.append('action', 'fotogrids_reorder_gallery_items');
            formData.append('gallery_id', window.fotogridsMetaBoxes?.postId || '');
            formData.append('item_order', JSON.stringify(newOrder));
            formData.append('nonce', nonce);

            const response = await fetch(ajaxUrl, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                console.error('Failed to save item order:', data.data);
            }
        } catch (error) {
            console.error('Error reordering items:', error);
        }
    }, [ajaxUrl, nonce]);

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
        setShowModal(true);
        await loadItemData(itemId);
    }, [loadItemData]);

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
            title:       data.title  || embedForm.title  || 'Video',
            thumbnail:   data.thumbnail_url || '',
            alt:         data.title  || '',
            favorite:    false,
            // carry embed meta so the grid can render the badge
            source:      embedForm.source,
        };

        setItems(prevItems => {
            const wasEmpty      = prevItems.length === 0;
            const updatedItems  = [...prevItems, newItem];

            if (wasEmpty) {
                updatedItems[0].favorite = true;
                saveFavoriteItem(updatedItems[0].id);
            }

            if (State) {
                State.items.setItems(updatedItems.map(i => String(i.id)).filter(Boolean));
            }

            return updatedItems;
        });

        if (window.fotogridsToast) {
            window.fotogridsToast.success(strings.videoEmbedAdded);
        }
    }, [saveFavoriteItem, strings]);

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
                            <div
                                className="fotogrids-noitems-add-block__icon"
                                dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.folder }}
                            />
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
                {items.map((item) => (
                    <div key={item.id} className="fotogrids-item-item" data-id={item.id} draggable="true">
                        <img
                            src={item.thumbnail}
                            alt={item.alt}
                            onClick={() => openItemModal(item.id)}
                            style={{ cursor: 'pointer' }}
                        />
                        <div className={`fotogrids-item-favorite ${item.favorite ? 'is-favorite' : ''}`}>
                            <button
                                type="button"
                                className="fotogrids-item-favorite-button"
                                onClick={() => toggleFavorite(item.id)}
                                title={item.favorite ? strings.removeFavorite : strings.makeFavorite}
                            >
                                <Icon name="star" />
                            </button>
                        </div>
                        <div className="fotogrids-item-controls">
                            <button
                                type="button"
                                className="fotogrids-edit-item"
                                onClick={() => openItemModal(item.id)}
                                title={strings.editItem}
                            >
                                <Icon name="edit" />
                            </button>
                            <button
                                type="button"
                                className="fotogrids-remove-item"
                                onClick={() => removeItem(item.id)}
                                title={strings.removeItem}
                            >
                                <Icon name="x" />
                            </button>
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
                ))}
            </div>
        );
    };

    const renderAddDropdown = () => (
        <div className="fotogrids-add-new-dropdown">
            <button
                type="button"
                className={`fotogrids-button fotogrids-button--primary fotogrids-button--smaller fotogrids-add-new-toggle ${showAddDropdown ? 'fotogrids-dropdown-open' : ''}`}
                onClick={() => setShowAddDropdown(!showAddDropdown)}
            >
                <Icon name="plus" />
                {strings.addNew}
                <Icon name="chevron_down" />
            </button>
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

    const clearAllFooter = (
        <>
            <button
                type="button"
                className="fotogrids-button fotogrids-button--secondary"
                onClick={closeClearAllModal}
            >
                {strings.cancel}
            </button>
            <button
                type="button"
                className="fotogrids-button fotogrids-button--danger"
                onClick={confirmClearAllItems}
                disabled={clearAllConfirmValue !== 'REMOVE ALL'}
            >
                {strings.removeAllItems}
            </button>
        </>
    );

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
                        <button
                            type="button"
                            className="fotogrids-button fotogrids-button--secondary fotogrids-button--smaller fotogrids-items-remove-all"
                            onClick={clearAllItems}
                        >
                            {strings.removeAll}
                        </button>
                        <button
                            type="button"
                            className="fotogrids-button fotogrids-button--secondary fotogrids-button--smaller fotogrids-items-bulk-editor"
                            onClick={() => {
                                if (window.FotoGridsUpgrade) {
                                    window.FotoGridsUpgrade.launchForFeature.bulkOperations();
                                }
                            }}
                        >
                            {strings.bulkEditor}
                            <span className="fotogrids-pro-badge">Pro</span>
                        </button>
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

            {/* Video Embed Modal */}
            <VideoEmbedModal
                isOpen={showVideoEmbedModal}
                onClose={() => setShowVideoEmbedModal(false)}
                onAdd={handleAddVideoEmbed}
                strings={strings}
            />

            <Modal
                isOpen={showClearAllModal}
                onClose={closeClearAllModal}
                title={strings.removeAllModalTitle}
                size="small"
                footer={clearAllFooter}
            >
                <div className="fotogrids-notice fotogrids-notice--warning">
                    <p><strong>{strings.removeAllModalWarning}</strong></p>
                </div>
                <p>{strings.removeAllModalBody}</p>
                <label className="fotogrids-checkbox">
                    <input
                        type="checkbox"
                        checked={clearAllDeleteCustomData}
                        onChange={(e) => setClearAllDeleteCustomData(e.target.checked)}
                    />
                    <span className="fotogrids-checkbox__indicator"></span>
                    <span>{strings.removeAllModalDeleteCustomDataLabel}</span>
                </label>
                <p className="description">{strings.removeAllModalDeleteCustomDataHelp}</p>
                <div className="fotogrids-form-group">
                    <label htmlFor="fotogrids-remove-all-confirm-input">
                        {strings.removeAllModalConfirmPrompt}
                    </label>
                    <input
                        id="fotogrids-remove-all-confirm-input"
                        type="text"
                        className="fotogrids-input"
                        value={clearAllConfirmValue}
                        onChange={(e) => setClearAllConfirmValue(e.target.value)}
                        placeholder={strings.removeAllModalConfirmPlaceholder}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default GalleryMetabox;
