/**
 * Gallery Preview Component
 * 
 * Live preview of gallery in admin metabox using the actual shortcode rendering
 */

import React, { useState, useEffect, useRef } from 'react';

const ensurePreviewCssAssets = (cssAssets) => {
    if (!cssAssets || typeof cssAssets !== 'object') {
        return;
    }

    Object.entries(cssAssets).forEach(([handle, href]) => {
        if (!handle || !href || typeof href !== 'string') {
            return;
        }

        const existingByHandle = document.querySelector(`link[data-fotogrids-preview-css="${handle}"]`);
        if (existingByHandle) {
            return;
        }

        const existingByHref = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
        if (existingByHref) {
            existingByHref.setAttribute('data-fotogrids-preview-css', handle);
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-fotogrids-preview-css', handle);
        document.head.appendChild(link);
    });
};

const GalleryPreview = ({ items = [], galleryId = null }) => {
    const previewRef = useRef(null);
    const [previewHtml, setPreviewHtml] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    
    // Get REST API configuration - try multiple sources
    const restNonce = window.fotogridsMetaBoxes?.restNonce || 
                      window.fotogridsAdmin?.restNonce || 
                      (window.wpApiSettings?.nonce || '');
    
    // Construct REST URL - try multiple sources
    let restUrl = '/wp-json/fotogrids/v1/';
    if (window.fotogridsAdmin?.apiUrl) {
        restUrl = window.fotogridsAdmin.apiUrl + 'fotogrids/v1/';
    } else if (window.fotogridsAdmin?.restUrl) {
        restUrl = (window.wpApiSettings?.root || '/wp-json/') + window.fotogridsAdmin.restUrl;
    } else if (window.wpApiSettings?.root) {
        restUrl = window.wpApiSettings.root + 'fotogrids/v1/';
    }
    
    // Get gallery ID from window if not provided
    const currentGalleryId = galleryId || window.fotogridsMetaBoxes?.postId || null;
    
    // Re-fetch whenever the collection is saved
    useEffect(() => {
        const handleSaved = () => setRefreshKey(k => k + 1);
        document.addEventListener('fotogrids:collection_saved', handleSaved);
        return () => document.removeEventListener('fotogrids:collection_saved', handleSaved);
    }, []);

    // Fetch preview HTML from REST endpoint
    useEffect(() => {
        if (!currentGalleryId) {
            setPreviewHtml('');
            return;
        }
        
        const fetchPreview = async () => {
            setLoading(true);
            setError(null);
            
            try {
                const response = await fetch(
                    `${restUrl}admin/galleries/${currentGalleryId}/preview`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-WP-Nonce': restNonce,
                        },
                        body: JSON.stringify({
                            version: 2,
                        }),
                    }
                );
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || 'Failed to fetch gallery preview');
                }
                
                const data = await response.json();
                setPreviewHtml(data.html || '');
                ensurePreviewCssAssets(data.assets?.css);
            } catch (err) {
                console.error('Error fetching gallery preview:', err);
                setError(err.message || 'Failed to load gallery preview.');
                setPreviewHtml('');
            } finally {
                setLoading(false);
            }
        };
        
        fetchPreview();
    }, [currentGalleryId, restUrl, restNonce, refreshKey]);
    
    // Initialize lightbox when HTML is loaded (if lightbox script is available)
    useEffect(() => {
        if (!previewHtml || !previewRef.current) {
            return;
        }
        
        // Check if lightbox script is loaded and initialize it for the preview container
        if (window.FotoGridsLightbox || (window.fotogrids && window.fotogrids.lightbox)) {
            // Lightbox will auto-initialize on elements with data-fotogrids-lightbox
            // No additional initialization needed if the script is loaded
        }
    }, [previewHtml]);
    
    // No gallery ID
    if (!currentGalleryId) {
        return (
            <div className="fotogrids-preview-placeholder">
                <p>{window.fotogridsMetaBoxes?.strings?.previewPlaceholder || 'Gallery preview will appear here.'}</p>
            </div>
        );
    }
    
    // Loading state
    if (loading) {
        return (
            <div className="fotogrids-preview-placeholder">
                <p>{window.fotogridsMetaBoxes?.strings?.loading || 'Loading preview...'}</p>
            </div>
        );
    }
    
    // Error state
    if (error) {
        return (
            <div className="fotogrids-preview-placeholder">
                <div style={{
                    padding: '12px',
                    backgroundColor: '#f8d7da',
                    border: '1px solid #f5c6cb',
                    borderRadius: '4px',
                    color: '#721c24',
                    fontSize: '13px',
                }}>
                    <strong>Error loading preview:</strong> {error}
                </div>
            </div>
        );
    }
    
    // Render preview HTML
    return (
        <div 
            className="fotogrids-preview-container" 
            ref={previewRef}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
    );
};

export default GalleryPreview;











