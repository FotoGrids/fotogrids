/**
 * Gallery Items Metabox React Component
 */

import React, { useState, useEffect, useCallback } from 'react';
import ItemEditModal from './ItemEditModal.jsx';

const Icon = ({ name, className = "" }) => {
    const icons = window.FotoGridsIcons || {};
    const iconSvg = icons[name];
    
    if (!iconSvg) {
        return <span className={`fotogrids-icon fotogrids-icon--${name} ${className}`}>{name}</span>;
    }
    
    return (
        <span 
            className={`fotogrids-icon fotogrids-icon--${name} ${className}`}
            dangerouslySetInnerHTML={{ __html: iconSvg }}
        />
    );
};

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

    const [activeTab, setActiveTab] = useState('manage');
    const [items, setItems] = useState(Array.isArray(galleryItems) ? galleryItems : []);
    const [showModal, setShowModal] = useState(false);
    const [currentItemId, setCurrentItemId] = useState(null);
    const [currentItemData, setCurrentItemData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAddDropdown, setShowAddDropdown] = useState(false);

    // Initialize items from props with safety check
    useEffect(() => {
        if (Array.isArray(galleryItems)) {
            setItems(galleryItems);
        }
    }, [galleryItems]);

    // Initialize sortable functionality
    useEffect(() => {
        const initializeSortable = () => {
            const gridElement = document.getElementById('fotogrids-items-grid');
            
            if (!gridElement || typeof jQuery === 'undefined' || typeof jQuery.ui === 'undefined') {
                return;
            }

            // Destroy existing sortable if it exists
            if (jQuery(gridElement).hasClass('ui-sortable')) {
                jQuery(gridElement).sortable('destroy');
            }

            // Initialize sortable
            jQuery(gridElement).sortable({
                items: '.fotogrids-item-item',
                cursor: 'move',
                opacity: 0.7,
                placeholder: 'fotogrids-item-placeholder',
                tolerance: 'pointer',
                start: function(event, ui) {
                    // Add translatable text to placeholder
                    jQuery('.fotogrids-item-placeholder').attr('data-drop-text', strings.dropHere || 'Drop here');
                },
                update: function(event, ui) {
                    const newOrder = jQuery(this).sortable('toArray', { attribute: 'data-id' });
                    handleReorderItems(newOrder);
                }
            });
        };

        // Initialize after a short delay to ensure DOM is ready
        const timeoutId = setTimeout(initializeSortable, 100);
        
        return () => {
            clearTimeout(timeoutId);
            const gridElement = document.getElementById('fotogrids-items-grid');
            if (gridElement && typeof jQuery !== 'undefined' && jQuery(gridElement).hasClass('ui-sortable')) {
                jQuery(gridElement).sortable('destroy');
            }
        };
    }, [items]); // Re-initialize when items change

    // Handle media uploader
    const openMediaUploader = useCallback(() => {
        if (typeof wp === 'undefined' || typeof wp.media === 'undefined') {
            alert(strings.mediaNotAvailable || 'WordPress media library is not available. Please refresh the page.');
            return;
        }

        const mediaUploader = wp.media({
            title: strings.selectItems || 'Select Items for Gallery',
            button: { text: strings.addToGallery || 'Add to Gallery' },
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
                alt: attachment.alt || attachment.title || ''
            }));

            // Add new items, avoiding duplicates
            setItems(prevItems => {
                const existingIds = new Set(prevItems.map(img => img.id));
                const uniqueNewItems = newItems.filter(img => !existingIds.has(img.id));
                return [...prevItems, ...uniqueNewItems];
            });
        });

        mediaUploader.open();
    }, [strings]);

    // Remove item
    const removeItem = useCallback((itemId) => {
        setItems(prevItems => prevItems.filter(img => img.id !== itemId));
    }, []);

    // Clear all items
    const clearAllItems = useCallback(() => {
        if (confirm(strings.confirmClear || 'Are you sure you want to remove all items?')) {
            setItems([]);
        }
    }, [strings]);

    // Handle item reordering
    const handleReorderItems = useCallback(async (newOrder) => {
        try {
            // Reorder items in state to match new order
            const reorderedItems = newOrder.map(id => 
                items.find(item => item.id.toString() === id.toString())
            ).filter(Boolean);
            
            setItems(reorderedItems);

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
    }, [items, ajaxUrl, nonce]);

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
                alert(strings.errorLoadingItem || 'Error loading item data');
                return false;
            }
        } catch (error) {
            console.error('Error loading item data:', error);
            alert(strings.errorLoadingItem || 'Error loading item data');
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
    }, []);

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
            default:
                console.log('Unknown action:', action);
        }
    }, [openMediaUploader]);

    // Render item grid
    const renderItemsGrid = () => {
        if (items.length === 0) {
            return (
                <p className="description">
                    {strings.noItems || 'No items selected. Click "Add New" to get started.'}
                </p>
            );
        }

        return (
            <div id="fotogrids-items-grid" className="fotogrids-sortable">
                {items.map((item) => (
                    <div key={item.id} className="fotogrids-item-item" data-id={item.id}>
                        <img 
                            src={item.thumbnail} 
                            alt={item.alt} 
                            onClick={() => openItemModal(item.id)}
                            style={{ cursor: 'pointer' }}
                        />
                        <div className="fotogrids-item-controls">
                            <button
                                type="button"
                                className="fotogrids-edit-item"
                                onClick={() => openItemModal(item.id)}
                                title={strings.editItem || 'Edit Item'}
                            >
                                <Icon name="edit" />
                            </button>
                            <button
                                type="button"
                                className="fotogrids-remove-item"
                                onClick={() => removeItem(item.id)}
                                title={strings.removeItem || 'Remove Item'}
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

    // Render add dropdown
    const renderAddDropdown = () => (
        <div className="fotogrids-add-new-dropdown">
            <button
                type="button"
                className={`fotogrids-button fotogrids-button--primary fotogrids-button--smaller fotogrids-add-new-toggle ${showAddDropdown ? 'fotogrids-dropdown-open' : ''}`}
                onClick={() => setShowAddDropdown(!showAddDropdown)}
            >
                <Icon name="plus" />
                {strings.addNew || 'Add New'}
                <Icon name="chevron-down" />
            </button>
            {showAddDropdown && (
                <div className="fotogrids-add-new-menu fotogrids-dropdown-open">
                    <div className="fotogrids-add-option" onClick={() => handleAddOption('upload')}>
						{strings.upload || 'Upload'}
                    </div>
                    <div className="fotogrids-add-option" onClick={() => handleAddOption('library')}>
						{strings.fromLibrary || 'From Library'}
                    </div>
                    <div className="fotogrids-add-option" onClick={() => handleAddOption('folder')}>
						{strings.fromFolder || 'From Folder'}
                    </div>
                    <div className="fotogrids-add-option" onClick={() => handleAddOption('zip')}>
						{strings.fromZip || 'From ZIP'}
                    </div>
                    <div className="fotogrids-add-option fotogrids-add-option--pro" onClick={() => handleAddOption('video')}>
						{strings.video || 'Video'}
						<span className="fotogrids-pro-badge">Pro</span>
                    </div>
                    <div className="fotogrids-add-option fotogrids-add-option--pro" onClick={() => handleAddOption('instagram')}>
						{strings.instagram || 'Instagram'}
						<span className="fotogrids-pro-badge">Pro</span>
                    </div>
                </div>
            )}
        </div>
    );

    // Close dropdown when clicking outside
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
                        {strings.manageItems || 'Manage Items'}
                    </button>
                    <button
                        type="button"
                        className={`fotogrids-gallery-tab ${activeTab === 'preview' ? 'fotogrids-gallery-tab--active' : ''}`}
                        onClick={() => handleTabSwitch('preview')}
                    >
                        <span className="fotogrids-icon" data-icon="preview"></span>
                        {strings.previewGallery || 'Preview Gallery'}
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
                            {strings.removeAll || 'Remove All'}
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
                            {strings.bulkEditor || 'Bulk Editor'}
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
                    <div className="fotogrids-preview-placeholder">
                        <p>{strings.previewPlaceholder || 'Gallery preview functionality will be implemented here.'}</p>
                    </div>
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
                    ajaxUrl={ajaxUrl}
                    nonce={nonce}
                    strings={strings}
                />
            )}

            {/* Hidden compatibility buttons for existing functionality */}
            <button type="button" id="fotogrids-add-items" style={{display: 'none'}} onClick={openMediaUploader} />
            <button type="button" id="fotogrids-clear-items" style={{display: 'none'}} onClick={clearAllItems} />
        </div>
    );
};

export default GalleryMetabox;
