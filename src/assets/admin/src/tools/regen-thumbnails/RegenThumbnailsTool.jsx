import React, { useState, useEffect, useRef, useCallback } from 'react';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

/**
 * Status badge component: renders ✓ (green) or ✗ (red) + optional dimension note.
 */
const SizeStatus = ({ status }) => {
    if (!status) {
        return <span className="fg-regen__status fg-regen__status--unknown">—</span>;
    }
    if (status.exists) {
        const note = (status.width && status.height) ? `${status.width}×${status.height}` : null;
        return (
            <span className="fg-regen__status fg-regen__status--ok" title={note || ''}>
                ✓{note ? <span className="fg-regen__status-note"> {note}</span> : null}
            </span>
        );
    }
    return <span className="fg-regen__status fg-regen__status--missing">✗</span>;
};

/**
 * Regenerate Thumbnails Tool
 *
 * Fetches per-attachment derivative status from the REST API, displays a
 * table, and supports per-item and bulk sequential regeneration with a
 * progress bar.
 *
 * REST base: /fotogrids/v1/admin/tools/regen-thumbnails/
 */
const RegenThumbnailsTool = () => {
    const [items, setItems] = useState([]);
    const [pluginSizes, setPluginSizes] = useState([]);
    const [customSizes, setCustomSizes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Bulk regeneration state
    const [regenActive, setRegenActive] = useState(false);
    const [regenProgress, setRegenProgress] = useState({ done: 0, total: 0 });
    const [regenItemId, setRegenItemId] = useState(null);
    const cancelledRef = useRef(false);

    const allSizeSlugs = [...pluginSizes, ...customSizes];

    // -------------------------------------------------------------------------
    // Load status on mount
    // -------------------------------------------------------------------------

    const loadStatus = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch({
                path: '/fotogrids/v1/admin/tools/regen-thumbnails/status',
            });
            setItems(data.items || []);
            setPluginSizes(data.plugin_sizes || []);
            setCustomSizes(data.custom_sizes || []);
        } catch (err) {
            setError(err?.message || __('Failed to load status.', 'fotogrids'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    // -------------------------------------------------------------------------
    // Single attachment regeneration
    // -------------------------------------------------------------------------

    const regenerateOne = useCallback(async (attachmentId) => {
        setRegenItemId(attachmentId);
        try {
            const result = await apiFetch({
                path: '/fotogrids/v1/admin/tools/regen-thumbnails/regenerate',
                method: 'POST',
                data: { attachment_id: attachmentId },
            });

            setItems(prev => prev.map(item => {
                if (item.attachment_id !== attachmentId) return item;
                return { ...item, sizes: result.sizes };
            }));
        } catch (err) {
            console.warn(`FotoGrids: Error regenerating attachment ${attachmentId}:`, err);
        } finally {
            setRegenItemId(null);
        }
    }, []);

    // -------------------------------------------------------------------------
    // Bulk regeneration
    // -------------------------------------------------------------------------

    const handleRegenAll = useCallback(async () => {
        cancelledRef.current = false;
        setRegenActive(true);
        setRegenProgress({ done: 0, total: items.length });

        for (let i = 0; i < items.length; i++) {
            if (cancelledRef.current) break;
            await regenerateOne(items[i].attachment_id);
            setRegenProgress({ done: i + 1, total: items.length });
        }

        setRegenActive(false);
        setRegenItemId(null);
    }, [items, regenerateOne]);

    const handleCancel = useCallback(() => {
        cancelledRef.current = true;
    }, []);

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    const niceSlug = (slug) => {
        if (slug === 'fotogrids_thumbnail') return __('FG Thumbnail', 'fotogrids');
        if (slug === 'fotogrids_full') return __('FG Full', 'fotogrids');
        return slug.replace(/^fotogrids_custom_/, '').replace(/_/g, ' ');
    };

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    if (loading) {
        return (
            <div className="fg-regen__loading">
                <span className="spinner is-active" style={{ float: 'none', marginTop: 0 }} />
                {__('Loading image data…', 'fotogrids')}
            </div>
        );
    }

    if (error) {
        return (
            <div className="fg-regen__error notice notice-error">
                <p>{error}</p>
                <button className="button" onClick={loadStatus}>
                    {__('Try again', 'fotogrids')}
                </button>
            </div>
        );
    }

    const progressPercent = regenProgress.total > 0
        ? Math.round((regenProgress.done / regenProgress.total) * 100)
        : 0;

    return (
        <div className="fg-regen-page">
            {/* Header toolbar */}
            <div className="fg-regen__toolbar">
                {!regenActive ? (
                    <button
                        className="button button-primary"
                        onClick={handleRegenAll}
                        disabled={items.length === 0}
                    >
                        {__('Regenerate All', 'fotogrids')}
                    </button>
                ) : (
                    <button className="button" onClick={handleCancel}>
                        {__('Cancel', 'fotogrids')}
                    </button>
                )}
                <button
                    className="button"
                    onClick={loadStatus}
                    disabled={regenActive}
                    style={{ marginLeft: 8 }}
                >
                    {__('Refresh Status', 'fotogrids')}
                </button>
            </div>

            {/* Progress bar */}
            {regenActive && (
                <div className="fg-regen__progress-wrap">
                    <div className="fg-regen__progress-bar" style={{ width: `${progressPercent}%` }} />
                    <span className="fg-regen__progress-label">
                        {regenProgress.done} / {regenProgress.total} &mdash; {progressPercent}%
                    </span>
                </div>
            )}

            {/* Table */}
            {items.length === 0 ? (
                <p className="fg-regen__empty">
                    {__('No gallery images found. Add images to a gallery first.', 'fotogrids')}
                </p>
            ) : (
                <div className="fg-regen__table-wrap">
                    <table className="wp-list-table widefat fixed striped fg-regen__table">
                        <thead>
                            <tr>
                                <th className="fg-regen__col-thumb">{__('Preview', 'fotogrids')}</th>
                                <th className="fg-regen__col-filename">{__('Filename', 'fotogrids')}</th>
                                {allSizeSlugs.map(slug => (
                                    <th key={slug} className="fg-regen__col-size">
                                        {niceSlug(slug)}
                                    </th>
                                ))}
                                <th className="fg-regen__col-action">{__('Action', 'fotogrids')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => {
                                const isBeingRegen = regenItemId === item.attachment_id;
                                return (
                                    <tr
                                        key={item.attachment_id}
                                        className={isBeingRegen ? 'fg-regen__row--active' : ''}
                                    >
                                        <td className="fg-regen__col-thumb">
                                            {item.thumb_url
                                                ? <img src={item.thumb_url} alt="" width="60" height="60" style={{ objectFit: 'cover' }} />
                                                : <span className="dashicons dashicons-format-image" />
                                            }
                                        </td>
                                        <td className="fg-regen__col-filename">
                                            <span title={item.filename}>{item.filename}</span>
                                        </td>
                                        {allSizeSlugs.map(slug => (
                                            <td key={slug} className="fg-regen__col-size">
                                                <SizeStatus status={item.sizes?.[slug]} />
                                            </td>
                                        ))}
                                        <td className="fg-regen__col-action">
                                            {isBeingRegen ? (
                                                <span className="spinner is-active" style={{ float: 'none', margin: 0 }} />
                                            ) : (
                                                <button
                                                    className="button button-small"
                                                    onClick={() => regenerateOne(item.attachment_id)}
                                                    disabled={regenActive}
                                                >
                                                    {__('Regenerate', 'fotogrids')}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default RegenThumbnailsTool;
