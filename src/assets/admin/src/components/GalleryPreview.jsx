/**
 * Gallery Preview Component
 *
 * Renders a gallery inside the wp-admin metabox using the exact same
 * Render_Controller pipeline that powers the public-facing embed. The preview
 * endpoint returns the HTML, the CSS/JS asset map, any inline payloads that
 * would normally land via wp_add_inline_script (the loading-icons map),
 * and the localize data the frontend modules read off `window.fotogrids`.
 *
 * The work in this component is to reproduce in the admin document the
 * runtime conditions a real page would have:
 *
 *   1. Set `window.fotogrids` before any module script runs.
 *   2. Load each CSS handle once (dedup across re-fetches).
 *   3. Load each JS handle once, attach its inline 'before' / 'after' payload
 *      around it. The fotogrids runtime self-bootstraps and installs the
 *      MutationObserver that every other module hooks via FotoGrids.onGallery.
 *   4. Replace the previous gallery wrapper with the freshly fetched HTML.
 *      Because innerHTML does not execute inline <script> tags, we walk the
 *      parsed fragment and clone each <script> into a real element so the
 *      per-gallery loading-icon kickoff script (emitted by Loading_Icon::
 *      html_after) actually runs.
 *
 * On every re-render the container is wiped and the HTML reinserted; the
 * runtime's MutationObserver picks up the new `.fotogrids-collection` node
 * and fires `fotogrids:gallery_inserted`, which lets every previously loaded
 * module wire itself onto the new instance.
 */

import React, { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Module-scope asset registries.
//
// Both maps survive React unmounts so we don't re-download a script the user
// already has on the page. The script Promise resolves only once load fires,
// so multiple concurrent preview fetches will wait for the same load instead
// of racing.
// ---------------------------------------------------------------------------

const loadedCssHandles = new Set();
const loadedJsHandles = new Map();  // handle -> Promise<void>
const appliedInlinePayloads = new Set();  // dedup key for inline before/after

/**
 * Ensures every CSS handle from the preview response has a <link> in the
 * document head. Subsequent calls with the same handle are no-ops.
 *
 * @param {Object<string, string>} cssAssets handle -> href map
 */
const ensurePreviewCssAssets = (cssAssets) => {
    if (!cssAssets || typeof cssAssets !== 'object') {
        return;
    }

    Object.entries(cssAssets).forEach(([handle, href]) => {
        if (!handle || typeof href !== 'string' || !href) {
            return;
        }
        if (loadedCssHandles.has(handle)) {
            return;
        }
        if (document.querySelector(`link[data-fotogrids-preview-css="${handle}"]`)) {
            loadedCssHandles.add(handle);
            return;
        }
        const existingByHref = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
        if (existingByHref) {
            existingByHref.setAttribute('data-fotogrids-preview-css', handle);
            loadedCssHandles.add(handle);
            return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-fotogrids-preview-css', handle);
        document.head.appendChild(link);
        loadedCssHandles.add(handle);
    });
};

/**
 * Loads a single external JS handle and resolves once the script's load event
 * fires. Repeated calls for the same handle return the cached promise so the
 * script is only fetched once even when multiple previews are in flight.
 *
 * @param {{ handle: string, src: string }} descriptor
 * @return {Promise<void>}
 */
const ensureScript = (descriptor) => {
    const { handle, src } = descriptor;
    if (!handle || !src) {
        return Promise.resolve();
    }
    if (loadedJsHandles.has(handle)) {
        return loadedJsHandles.get(handle);
    }

    const promise = new Promise((resolve) => {
        const existing = document.querySelector(`script[data-fotogrids-preview-js="${handle}"]`);
        if (existing) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = false;  // preserve execution order
        script.setAttribute('data-fotogrids-preview-js', handle);
        script.addEventListener('load', () => resolve());
        script.addEventListener('error', () => {
            // Resolve anyway — a broken module shouldn't block the rest of the
            // preview. The browser console will surface the network error.
            resolve();
        });
        document.head.appendChild(script);
    });

    loadedJsHandles.set(handle, promise);
    return promise;
};

/**
 * Injects an inline script payload exactly once per (handle, position) pair.
 * Used for the loading-icons map and drainer that the loading-icon feature
 * normally attaches via wp_add_inline_script() during wp_footer.
 *
 * @param {string} handle
 * @param {string} position 'before' or 'after'
 * @param {string} code
 */
const ensureInlineScript = (handle, position, code) => {
    if (!code) {
        return;
    }
    const key = `${handle}::${position}`;
    if (appliedInlinePayloads.has(key)) {
        return;
    }
    const script = document.createElement('script');
    script.setAttribute('data-fotogrids-preview-inline', key);
    script.textContent = code;
    document.head.appendChild(script);
    appliedInlinePayloads.add(key);
};

/**
 * Loads every JS descriptor returned by the preview endpoint, sequenced so
 * each script's load event resolves before the next one starts. Sequencing
 * matters because module scripts depend on the runtime having defined
 * `window.FotoGrids` and on the loading-icon main script being on the page
 * before the inline `before` payload (which calls into globals it expects to
 * have been registered).
 *
 * @param {Array<Object>} jsDescriptors
 */
const ensureScriptsSequenced = async (jsDescriptors) => {
    if (!Array.isArray(jsDescriptors)) {
        return;
    }
    for (const descriptor of jsDescriptors) {
        if (!descriptor || typeof descriptor !== 'object') {
            continue;
        }
        // Apply the inline 'before' payload BEFORE the external script so
        // any global it defines (e.g. window.fotogridsLoadingIcons) is
        // available when the main script executes.
        ensureInlineScript(descriptor.handle, 'before', descriptor.inline_before || '');
        await ensureScript(descriptor);
        ensureInlineScript(descriptor.handle, 'after', descriptor.inline_after || '');
    }
};

/**
 * Inserts the rendered preview HTML into the container and re-runs any inline
 * <script> tags it contains. innerHTML does not execute scripts on its own,
 * so we replace each script element with a fresh clone — that path does
 * execute. The per-gallery loading-icon kickoff (Loading_Icon::html_after)
 * is the main consumer; without this step the spinner never animates and
 * the gallery appears stuck on loading.
 *
 * @param {HTMLElement} container
 * @param {string} html
 */
const injectPreviewHtml = (container, html) => {
    container.innerHTML = '';
    if (!html) {
        return;
    }
    const template = document.createElement('template');
    template.innerHTML = html;
    container.appendChild(template.content);

    const scripts = container.querySelectorAll('script');
    scripts.forEach((node) => {
        const replacement = document.createElement('script');
        for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            replacement.setAttribute(attr.name, attr.value);
        }
        replacement.textContent = node.textContent;
        node.parentNode.replaceChild(replacement, node);
    });
};

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
                    `${restUrl}admin/galleries/${currentGalleryId}/preview`,
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

                // Publish the localize data BEFORE any module script runs so
                // sharing / lightbox / pagination see the deep-link config
                // and REST endpoints. Merge so we don't clobber anything an
                // already-loaded script may have set.
                const localize = data?.assets?.localize?.fotogrids;
                if (localize && typeof localize === 'object') {
                    window.fotogrids = Object.assign({}, window.fotogrids || {}, localize);
                }

                ensurePreviewCssAssets(data?.assets?.css);
                await ensureScriptsSequenced(data?.assets?.js);

                if (seq !== requestSeqRef.current || !previewRef.current) {
                    return;
                }

                injectPreviewHtml(previewRef.current, data.html || '');
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
