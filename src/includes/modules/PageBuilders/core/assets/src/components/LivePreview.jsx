/**
 * LivePreview - server-rendered preview of a gallery or album.
 *
 * Wraps the safe-preview pipeline (`applyPreviewResponse`) in a React
 * component for any page-builder host. Same machinery the metabox uses,
 * just packaged for block hosts.
 *
 * Renders:
 *   - loading state while the REST request is in flight
 *   - error state if the REST call fails
 *   - the live preview HTML once the response lands
 *
 * Re-fetches when `kind`, `id`, or `refreshToken` change. Debounced to
 * avoid hammering the endpoint on rapid attribute edits.
 *
 * Props:
 *   - kind:        'gallery' | 'album'
 *   - id:          number  (gallery or album post id)
 *   - restUrl:     string  base rest URL ending in `fotogrids/v1/`
 *   - restNonce:   string
 *   - refreshToken: any    bump to force a re-fetch
 *   - onResponse:  (data) => void  optional, called with the parsed response
 */

import React, { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';

import { applyPreviewResponse } from '../lib/preview-asset-wiring';

const DEBOUNCE_MS = 300;

const LivePreview = ({
    kind,
    id,
    restUrl,
    restNonce,
    refreshToken = 0,
    onResponse,
    clickBehavior = false,
    pagination = false,
}) => {
    const containerRef = useRef(null);
    const requestSeqRef = useRef(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Capture-phase click guard for pagination chrome.
    //
    // When the pagination toggle is OFF the server still emits the real
    // pagination chrome (so the layout looks just like the public page),
    // but we don't want the load-more / page-button handlers to actually
    // navigate the gallery. A capture-phase listener on the wrapper
    // catches the event before the gallery's own click handler binds and
    // stops it. Effective on every flavour of pagination (load-more,
    // endless-scroll button, page-buttons), all of which carry
    // `.fg-pagination__btn`.
    useEffect(() => {
        const node = containerRef.current;
        if (!node || pagination) {
            return undefined;
        }
        const blockPagination = (event) => {
            const target = event.target;
            if (target && target.closest && target.closest('.fg-pagination, .fg-pagination__btn')) {
                // eslint-disable-next-line no-console
                if (window.FOTOGRIDS_DEBUG_PAGINATION) {
                    console.log('[FotoGrids/LivePreview] pagination guard swallowing click', target);
                }
                event.stopPropagation();
                event.stopImmediatePropagation();
                event.preventDefault();
            }
        };
        node.addEventListener('click', blockPagination, true);
        // eslint-disable-next-line no-console
        if (window.FOTOGRIDS_DEBUG_PAGINATION) {
            console.log('[FotoGrids/LivePreview] pagination guard bound on', node);
        }
        return () => node.removeEventListener('click', blockPagination, true);
    }, [pagination]);

    useEffect(() => {
        if (!id || !restUrl) {
            return undefined;
        }
        if (kind !== 'gallery' && kind !== 'album') {
            return undefined;
        }

        const seq = ++requestSeqRef.current;
        const url = `${restUrl}preview/${kind}/${id}`;

        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': restNonce,
                    },
                    body: JSON.stringify({
                        version: 2,
                        preview_options: {
                            click_behavior: !!clickBehavior,
                            pagination: !!pagination,
                        },
                    }),
                });

                if (!response.ok) {
                    const errBody = await response.json().catch(() => ({}));
                    throw new Error(
                        errBody.message
                            || __('Failed to fetch preview.', 'fotogrids')
                    );
                }

                const data = await response.json();
                if (seq !== requestSeqRef.current) {
                    return;
                }

                if (typeof onResponse === 'function') {
                    onResponse(data);
                }

                if (!containerRef.current) {
                    return;
                }

                await applyPreviewResponse(containerRef.current, data);
            } catch (err) {
                if (seq !== requestSeqRef.current) {
                    return;
                }
                console.error('FotoGrids LivePreview: fetch failed', err);
                setError(err.message || __('Failed to load preview.', 'fotogrids'));
                if (containerRef.current) {
                    containerRef.current.innerHTML = '';
                }
            } finally {
                if (seq === requestSeqRef.current) {
                    setLoading(false);
                }
            }
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [kind, id, restUrl, restNonce, refreshToken, onResponse, pagination, clickBehavior]);

    // Wrapper-class strategy:
    //   - Click-behavior toggle: handled server-side by forcing
    //     item_click_behavior='nothing'. No client class needed - the
    //     render simply doesn't bind a click handler.
    //   - Pagination toggle: server still slices items and renders the
    //     pagination chrome; the client intercepts pagination button
    //     clicks via a capture-phase listener so users see the buttons
    //     but they don't do anything.
    const wrapperClass = [
        'fg-pb-live-preview',
        !pagination && 'is-fg-pb-pagination-frozen',
    ].filter(Boolean).join(' ');

    return (
        <div className={wrapperClass}>
            {loading && (
                <div className="fg-pb-live-preview__loading">
                    {__('Loading preview…', 'fotogrids')}
                </div>
            )}
            {error && (
                <div className="fg-pb-live-preview__error">
                    <strong>{__('Couldn’t load preview.', 'fotogrids')}</strong>{' '}
                    <span>{error}</span>
                </div>
            )}
            <div
                className="fg-pb-live-preview__container"
                ref={containerRef}
            />
        </div>
    );
};

export default LivePreview;
