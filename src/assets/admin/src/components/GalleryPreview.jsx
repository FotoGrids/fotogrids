/**
 * Gallery Preview Component
 *
 * Renders a gallery inside the wp-admin metabox using the exact same
 * Render_Controller pipeline that powers the public-facing embed. The
 * preview endpoint returns the HTML, the CSS/JS asset map, any inline
 * payloads that would normally land via wp_add_inline_script (the
 * loading-icons map), and the localize data the frontend modules read off
 * `window.fotogrids`.
 *
 * All the heavy lifting (CSS handle dedup, JS sequencing, inline payload
 * execution, MutationObserver pickup) lives in the shared
 * `preview-asset-wiring.js` utility under the PageBuilders module - that
 * util is the single source of truth used by this metabox, the Gutenberg
 * block live preview, and any future Elementor / Divi / Bricks widgets.
 *
 * This component is now a thin React shell that:
 *
 *   1. Resolves the REST URL + nonce from the localized globals.
 *   2. Fetches the preview payload for the current gallery id.
 *   3. Delegates wiring to applyPreviewResponse().
 *   4. Drives loading / error UI.
 *
 * On every re-render the container is wiped and the HTML reinserted; the
 * runtime's MutationObserver picks up the new `.fotogrids-collection` node
 * and fires `fotogrids:gallery_inserted`, which lets every previously
 * loaded module wire itself onto the new instance.
 */

import React, { useEffect, useRef, useState } from 'react';

import { applyPreviewResponse } from '@modules/PageBuilders/core/assets/src/lib/preview-asset-wiring';

const GalleryPreview = ({ galleryId = null }) => {
    const previewRef = useRef(null);
    const requestSeqRef = useRef(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const restNonce = window.fotogridsMetaBoxes?.restNonce
        || window.fotogridsAdmin?.restNonce
        || (window.wpApiSettings?.nonce || '');

    let restUrl = '/wp-json/fotogrids/v1/';
    if (window.fotogridsAdmin?.apiUrl) {
        restUrl = window.fotogridsAdmin.apiUrl + 'fotogrids/v1/';
    } else if (window.fotogridsAdmin?.restUrl) {
        restUrl = (window.wpApiSettings?.root || '/wp-json/') + window.fotogridsAdmin.restUrl;
    } else if (window.wpApiSettings?.root) {
        restUrl = window.wpApiSettings.root + 'fotogrids/v1/';
    }

    const currentGalleryId = galleryId || window.fotogridsMetaBoxes?.postId || null;

    useEffect(() => {
        const handleSaved = () => setRefreshKey((k) => k + 1);
        document.addEventListener('fotogrids:collection_saved', handleSaved);
        return () => document.removeEventListener('fotogrids:collection_saved', handleSaved);
    }, []);

    useEffect(() => {
        if (!currentGalleryId) {
            return;
        }

        const seq = ++requestSeqRef.current;
        setLoading(true);
        setError(null);

        const fetchPreview = async () => {
            try {
                const response = await fetch(
                    `${restUrl}preview/gallery/${currentGalleryId}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-WP-Nonce': restNonce,
                        },
                        body: JSON.stringify({ version: 2 }),
                    }
                );

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || 'Failed to fetch gallery preview');
                }

                const data = await response.json();
                if (seq !== requestSeqRef.current) {
                    return;  // a newer fetch superseded this one
                }

                if (!previewRef.current) {
                    return;
                }

                await applyPreviewResponse(previewRef.current, data);
            } catch (err) {
                if (seq !== requestSeqRef.current) {
                    return;
                }
                console.error('Error fetching gallery preview:', err);
                setError(err.message || 'Failed to load gallery preview.');
                if (previewRef.current) {
                    previewRef.current.innerHTML = '';
                }
            } finally {
                if (seq === requestSeqRef.current) {
                    setLoading(false);
                }
            }
        };

        fetchPreview();
    }, [currentGalleryId, restUrl, restNonce, refreshKey]);

    if (!currentGalleryId) {
        return (
            <div className="fotogrids-preview-placeholder">
                <p>{window.fotogridsMetaBoxes?.strings?.previewPlaceholder || 'Gallery preview will appear here.'}</p>
            </div>
        );
    }

    return (
        <>
            {loading && (
                <div className="fotogrids-preview-loading">
                    <p>{window.fotogridsMetaBoxes?.strings?.loading || 'Loading preview...'}</p>
                </div>
            )}
            {error && (
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
            )}
            <div
                className="fotogrids-preview-container"
                ref={previewRef}
            />
        </>
    );
};

export default GalleryPreview;
