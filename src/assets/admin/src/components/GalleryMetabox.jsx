/**
 * Gallery Items Metabox React Component
 */

import React, { useState, useEffect, useCallback } from 'react';
import ItemEditModal from './ItemEditModal.jsx';
import VideoEmbedModal from './VideoEmbedModal.jsx';
import FolderImportModal from './FolderImportModal.jsx';
import ZipImportModal from './ZipImportModal.jsx';
import { Confirm } from './shared/Modal';
import Checkbox from './shared/Checkbox';
import DangerZone from './shared/DangerZone.jsx';
import GalleryPreview from './GalleryPreview.jsx';
import MetaboxHeader from './gallery-metabox/components/MetaboxHeader.jsx';
import ItemsGrid from './gallery-metabox/components/ItemsGrid.jsx';
import ItemsEmptyState from './gallery-metabox/components/ItemsEmptyState.jsx';
import useGalleryItems from './gallery-metabox/hooks/useGalleryItems';
import useItemDragSort from './gallery-metabox/hooks/useItemDragSort';
import useMediaUploader from './gallery-metabox/hooks/useMediaUploader';
import { createEmbed, updateEmbed } from './gallery-metabox/api/embed-api';

const TABS = ['manage', 'preview'];

const GalleryMetabox = ({
    galleryItems = [],
    ajaxUrl = '',
    nonce = '',
    strings = {}
}) => {

    if (!React || !useState || !useEffect || !useCallback) {
        console.error('React hooks not available');
        return React.createElement('div', {}, 'React hooks not available');
    }

    const uiState = window.FotoGridsUiState?.createNamespace({
        area: 'gallery-items',
        postId: window.fotogridsMetaBoxes?.postId || 0,
    });
    const [activeTab, setActiveTab] = useState(() => {
        if (!uiState) return 'manage';
        return uiState.getValue({ key: 'main-tab', fallback: 'manage', urlParam: 'fg-items-tab', allowed: TABS });
    });
    const [showModal, setShowModal] = useState(false);
    const [showVideoEmbedModal, setShowVideoEmbedModal] = useState(false);
    const [showFolderImportModal, setShowFolderImportModal] = useState(false);
    const [showZipImportModal, setShowZipImportModal] = useState(false);
    const [editingEmbed, setEditingEmbed] = useState(null);
    const [showClearAllModal, setShowClearAllModal] = useState(false);
    const [clearAllDeleteCustomData, setClearAllDeleteCustomData] = useState(false);
    const [currentItemId, setCurrentItemId] = useState(null);
    const [currentItemData, setCurrentItemData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAddDropdown, setShowAddDropdown] = useState(false);

    const {
        items,
        setItems,
        appendItems,
        handleUploadComplete,
        setFeatured,
        removeItem,
        clearAllItems,
        reorderItems,
    } = useGalleryItems({ galleryItems, strings });

    const openMediaUploader = useMediaUploader({ strings, onSelect: appendItems });

    useItemDragSort({ items, strings, onReorder: reorderItems });

    const openClearAllModal = useCallback(() => {
        setClearAllDeleteCustomData(false);
        setShowClearAllModal(true);
    }, []);

    const closeClearAllModal = useCallback(() => {
        setShowClearAllModal(false);
        setClearAllDeleteCustomData(false);
    }, []);

    // Shared by openItemModal and navigateItem.
    const loadItemData = useCallback(async (itemId) => {
        setLoading(true);

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
                if (window.fotogridsToast) {
                    window.fotogridsToast.error(strings.errorLoadingItem);
                }
                return false;
            }
        } catch (error) {
            console.error('Error loading item data:', error);
            if (window.fotogridsToast) {
                window.fotogridsToast.error(strings.errorLoadingItem);
            }
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

    const handleTabSwitch = useCallback((tabId) => {
        setActiveTab(tabId);
        setShowAddDropdown(false);
        if (uiState) {
            uiState.setValue({ key: 'main-tab', value: tabId, urlParam: 'fg-items-tab' });
        }
    }, [uiState]);

    const handleAddOption = useCallback((action) => {
        setShowAddDropdown(false);

        switch (action) {
            case 'upload':
                openMediaUploader('upload');
                break;
            case 'library':
                openMediaUploader('browse');
                break;
            case 'folder':
                setShowFolderImportModal(true);
                break;
            case 'zip':
                setShowZipImportModal(true);
                break;
            case 'video_embed':
                setShowVideoEmbedModal(true);
                break;
        }
    }, [openMediaUploader]);

    /**
     * Called by VideoEmbedModal when the user confirms. Creates the virtual
     * item, then inserts the returned item object into the grid.
     */
    const handleAddVideoEmbed = useCallback(async (embedForm) => {
        const galleryId = window.fotogridsMetaBoxes?.postId || '';
        const data = await createEmbed({ embedForm, galleryId });

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
    }, [setItems, strings]);

    /**
     * Called by VideoEmbedModal when editing an existing embed. Updates the
     * embed and refreshes the item in the grid.
     */
    const handleUpdateVideoEmbed = useCallback(async (embedForm) => {
        const embedId = embedForm.id;
        const data = await updateEmbed({ embedForm });

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
    }, [setItems, strings]);

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
            <MetaboxHeader
                activeTab={activeTab}
                strings={strings}
                onTabSwitch={handleTabSwitch}
                addDropdownOpen={showAddDropdown}
                onAddDropdownToggle={() => setShowAddDropdown(!showAddDropdown)}
                onAddOption={handleAddOption}
                onClearAll={openClearAllModal}
            />

            <div className="fotogrids-gallery-content">
                <div className={`fotogrids-gallery-tab-content ${activeTab === 'manage' ? 'fotogrids-gallery-tab-content--active' : ''}`}>
                    <div id="fotogrids-items-container">
                        {items.length === 0 ? (
                            <ItemsEmptyState
                                strings={strings}
                                onUploadComplete={handleUploadComplete}
                                onFromLibrary={() => openMediaUploader()}
                                onVideoEmbed={() => setShowVideoEmbedModal(true)}
                            />
                        ) : (
                            <ItemsGrid
                                items={items}
                                strings={strings}
                                onOpenItem={openItemModal}
                                onToggleFeatured={setFeatured}
                                onRemoveItem={removeItem}
                            />
                        )}
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

            <VideoEmbedModal
                isOpen={showVideoEmbedModal}
                editItem={editingEmbed}
                onClose={() => { setShowVideoEmbedModal(false); setEditingEmbed(null); }}
                onAdd={handleAddVideoEmbed}
                onUpdate={handleUpdateVideoEmbed}
                strings={strings}
            />

            <FolderImportModal
                isOpen={showFolderImportModal}
                onClose={() => setShowFolderImportModal(false)}
                onAddItems={appendItems}
                onUploadComplete={handleUploadComplete}
                galleryId={window.fotogridsMetaBoxes?.postId || 0}
                strings={strings}
            />

            <ZipImportModal
                isOpen={showZipImportModal}
                onClose={() => setShowZipImportModal(false)}
                onAddItems={appendItems}
                galleryId={window.fotogridsMetaBoxes?.postId || 0}
                strings={strings}
            />

            <Confirm
                isOpen={showClearAllModal}
                onClose={closeClearAllModal}
                onConfirm={clearAllItems}
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
            </Confirm>
        </div>
    );
};

export default GalleryMetabox;
