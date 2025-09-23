/**
 * Gallery Images Metabox React Component
 */

import React, { useState, useEffect, useCallback } from 'react';
import ImageEditModal from './ImageEditModal.jsx';

const GalleryMetabox = ({ 
    galleryImages = [], 
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
    const [images, setImages] = useState(Array.isArray(galleryImages) ? galleryImages : []);
    const [showModal, setShowModal] = useState(false);
    const [currentImageId, setCurrentImageId] = useState(null);
    const [currentImageData, setCurrentImageData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAddDropdown, setShowAddDropdown] = useState(false);

    // Initialize images from props with safety check
    useEffect(() => {
        if (Array.isArray(galleryImages)) {
            setImages(galleryImages);
        }
    }, [galleryImages]);

    // Handle media uploader
    const openMediaUploader = useCallback(() => {
        if (typeof wp === 'undefined' || typeof wp.media === 'undefined') {
            alert(strings.mediaNotAvailable || 'WordPress media library is not available. Please refresh the page.');
            return;
        }

        const mediaUploader = wp.media({
            title: strings.selectImages || 'Select Images for Gallery',
            button: { text: strings.addToGallery || 'Add to Gallery' },
            multiple: true,
            library: { type: 'image' }
        });

        mediaUploader.on('select', () => {
            const attachments = mediaUploader.state().get('selection').toJSON();
            
            const newImages = attachments.map(attachment => ({
                id: attachment.id,
                title: attachment.title || attachment.filename || 'Untitled',
                url: attachment.url,
                thumbnail: attachment.sizes?.thumbnail?.url || attachment.url,
                alt: attachment.alt || attachment.title || ''
            }));

            // Add new images, avoiding duplicates
            setImages(prevImages => {
                const existingIds = new Set(prevImages.map(img => img.id));
                const uniqueNewImages = newImages.filter(img => !existingIds.has(img.id));
                return [...prevImages, ...uniqueNewImages];
            });
        });

        mediaUploader.open();
    }, [strings]);

    // Remove image
    const removeImage = useCallback((imageId) => {
        setImages(prevImages => prevImages.filter(img => img.id !== imageId));
    }, []);

    // Clear all images
    const clearAllImages = useCallback(() => {
        if (confirm(strings.confirmClear || 'Are you sure you want to remove all images?')) {
            setImages([]);
        }
    }, [strings]);

    // Open image edit modal
    // Load image data function (shared by openImageModal and navigateImage)
    const loadImageData = useCallback(async (imageId) => {
        setLoading(true);
        
        // Add delay to see loading state (for debugging)
        // await new Promise(resolve => setTimeout(resolve, 10000));
        
        try {
            const formData = new FormData();
            formData.append('action', 'fotogrids_get_image_data');
            formData.append('image_id', imageId);
            formData.append('nonce', nonce);

            const response = await fetch(ajaxUrl, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                setCurrentImageData(data.data);
                setCurrentImageId(imageId);
                return true;
            } else {
                alert(strings.errorLoadingImage || 'Error loading image data');
                return false;
            }
        } catch (error) {
            console.error('Error loading image data:', error);
            alert(strings.errorLoadingImage || 'Error loading image data');
            return false;
        } finally {
            setLoading(false);
        }
    }, [ajaxUrl, nonce, strings]);

    const openImageModal = useCallback(async (imageId) => {
        setShowModal(true);
        await loadImageData(imageId);
    }, [loadImageData]);

    // Navigate between images in modal
    const navigateImage = useCallback(async (direction) => {
        const currentIndex = images.findIndex(img => img.id === currentImageId);
        let nextIndex;

        if (direction === 'prev') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
        } else {
            nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
        }

        const nextImageId = images[nextIndex]?.id;
        if (nextImageId) {
            await loadImageData(nextImageId);
        }
    }, [images, currentImageId, loadImageData]);

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

    // Render image grid
    const renderImageGrid = () => {
        if (images.length === 0) {
            return (
                <p className="description">
                    {strings.noImages || 'No images selected. Click "Add New" to get started.'}
                </p>
            );
        }

        return (
            <div id="fotogrids-images-grid" className="fotogrids-sortable">
                {images.map((image) => (
                    <div key={image.id} className="fotogrids-image-item" data-id={image.id}>
                        <img 
                            src={image.thumbnail} 
                            alt={image.alt} 
                            onClick={() => openImageModal(image.id)}
                            style={{ cursor: 'pointer' }}
                        />
                        <div className="fotogrids-image-controls">
                            <button
                                type="button"
                                className="fotogrids-edit-image"
                                onClick={() => openImageModal(image.id)}
                                title={strings.editImage || 'Edit Image'}
                            >
                                <span className="fotogrids-icon" data-icon="edit"></span>
                            </button>
                            <button
                                type="button"
                                className="fotogrids-remove-image"
                                onClick={() => removeImage(image.id)}
                                title={strings.removeImage || 'Remove Image'}
                            >
                                <span className="fotogrids-icon" data-icon="x"></span>
                            </button>
                        </div>
                        <div className="fotogrids-image-title">
                            {image.title.length > 20 ? image.title.substring(0, 20) + '...' : image.title}
                        </div>
                        <input 
                            type="hidden" 
                            name="fotogrids_gallery_images[]" 
                            value={image.id} 
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
                className={`button button-primary fotogrids-add-new-toggle ${showAddDropdown ? 'fotogrids-dropdown-open' : ''}`}
                onClick={() => setShowAddDropdown(!showAddDropdown)}
            >
                <span className="fotogrids-icon fotogrids-button-icon-before" data-icon="plus"></span>
                {strings.addNew || 'Add New'}
                <span className="fotogrids-icon" data-icon="chevron-down"></span>
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
                    <div className="fotogrids-add-option fotogrids-add-option--pro">
						{strings.video || 'Video'}
						<span className="fotogrids-pro-badge">Pro</span>
                    </div>
                    <div className="fotogrids-add-option fotogrids-add-option--pro">
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
                            className="button fotogrids-remove-all"
                            onClick={clearAllImages}
                        >
                            {strings.removeAll || 'Remove All'}
                        </button>
                    </div>
                )}
            </div>

            {/* Tab content */}
            <div className="fotogrids-gallery-content">
                <div className={`fotogrids-gallery-tab-content ${activeTab === 'manage' ? 'fotogrids-gallery-tab-content--active' : ''}`}>
                    <div id="fotogrids-images-container">
                        {renderImageGrid()}
                    </div>
                </div>

                <div className={`fotogrids-gallery-tab-content ${activeTab === 'preview' ? 'fotogrids-gallery-tab-content--active' : ''}`}>
                    <div className="fotogrids-preview-placeholder">
                        <p>{strings.previewPlaceholder || 'Gallery preview functionality will be implemented here.'}</p>
                    </div>
                </div>
            </div>

            {/* Image Edit Modal */}
            {showModal && (
                <ImageEditModal
                    imageId={currentImageId}
                    imageData={currentImageData}
                    loading={loading}
                    images={images}
                    onClose={() => setShowModal(false)}
                    onNavigate={navigateImage}
                    ajaxUrl={ajaxUrl}
                    nonce={nonce}
                    strings={strings}
                />
            )}

            {/* Hidden compatibility buttons for existing functionality */}
            <button type="button" id="fotogrids-add-images" style={{display: 'none'}} onClick={openMediaUploader} />
            <button type="button" id="fotogrids-clear-images" style={{display: 'none'}} onClick={clearAllImages} />
        </div>
    );
};

export default GalleryMetabox;
