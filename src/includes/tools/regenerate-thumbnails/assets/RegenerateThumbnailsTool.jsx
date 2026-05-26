import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import Panel from '@/admin/src/components/shared/SidebarTabs/elements/Panel.jsx';
import TabBar from '@/admin/src/components/shared/TabBar.jsx';
import Icon from '@/admin/src/components/shared/Icon.jsx';
import Toggle from '@/admin/src/components/shared/Toggle.jsx';
import Tooltip from '@/admin/src/components/Tooltip.jsx';

const baseClass = 'fg-regenerate-thumbnails';

const SizeStatus = ({ status }) => {
    if (!status) {
        return <span className={`${baseClass}__status ${baseClass}__status--unknown`}>-</span>;
    }

    if (status.exists) {
        const note = (status.width && status.height) ? `${status.width}×${status.height}` : null;
        return (
            <span className={`${baseClass}__status ${baseClass}__status--ok`} title={note || ''}>
                <Icon name="check_circle" />{note ? <span className={`${baseClass}__status-note`}> {note}</span> : null}
            </span>
        );
    }

    return (
        <span className={`${baseClass}__status ${baseClass}__status--missing`}>
            <Icon name="alert_circle" />
        </span>
    );
};

/**
 * Compact "X exist / Y missing" cell with hover tooltip showing the detailed
 * per-slug list.
 */
const OtherSizesCell = ({ slugs, sizes }) => {
    const { existing, missing, detailList } = useMemo(() => {
        let existingCount = 0;
        let missingCount  = 0;
        const list = slugs.map((slug) => {
            const status = sizes?.[slug];
            const exists = !!status?.exists;
            if (exists) existingCount++; else missingCount++;
            return { slug, exists };
        });
        return { existing: existingCount, missing: missingCount, detailList: list };
    }, [slugs, sizes]);

    const tooltipContent = (
        <ul className={`${baseClass}__other-sizes-list`}>
            {detailList.map(({ slug, exists }) => (
                <li
                    key={slug}
                    className={
                        exists
                            ? `${baseClass}__other-size ${baseClass}__other-size--ok`
                            : `${baseClass}__other-size ${baseClass}__other-size--missing`
                    }
                >
                    <span className={`${baseClass}__other-size-mark`} aria-hidden="true">
                        {exists ? <Icon name="check_circle" /> : <Icon name="alert_circle" />}
                    </span>
                    <span className={`${baseClass}__other-size-slug`}>{slug}</span>
                </li>
            ))}
        </ul>
    );

    return (
        <Tooltip content={tooltipContent} position="top">
            <span className={`${baseClass}__other-summary`}>
                {existing > 0 && (
                    <span className={`${baseClass}__other-summary-pair ${baseClass}__other-summary-pair--ok`}>
                        <Icon name="check_circle" />
                        <span>{existing}</span>
                    </span>
                )}
                {missing > 0 && (
                    <span className={`${baseClass}__other-summary-pair ${baseClass}__other-summary-pair--missing`}>
                        <Icon name="alert_circle" />
                        <span>{missing}</span>
                    </span>
                )}
            </span>
        </Tooltip>
    );
};

/**
 * Regenerate Thumbnails Tool
 *
 * Two tabs:
 *   - "Regenerate" (default): table of attachments with per-size status.
 *   - "Log" (revealed once user triggers regeneration): progress bar + a
 *     scrolling chronological log of each regenerated file, with per-size
 *     generated/skipped + inferred reason.
 *
 * REST base: /fotogrids/v1/admin/tools/regenerate-thumbnails/
 */
const RegenerateThumbnailsTool = () => {
    // --------------------------------------------------------------
    // Data state
    // --------------------------------------------------------------
    const [items, setItems] = useState([]);
    const [pluginSizes, setPluginSizes] = useState([]);
    const [customSizes, setCustomSizes] = useState([]);
    const [otherSizes, setOtherSizes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters / pagination
    const [includeUnused, setIncludeUnused] = useState(false);
    const [page, setPage] = useState(1);
    const [perPage] = useState(50);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Regeneration state
    const [regenActive, setRegenActive] = useState(false);
    const [regenProgress, setRegenProgress] = useState({ done: 0, total: 0 });
    const [regenItemId, setRegenItemId] = useState(null);
    const cancelledRef = useRef(false);

    // Tabs + log
    const [logVisible, setLogVisible] = useState(false);
    const [activeTab, setActiveTab] = useState('regenerate');
    const [logEntries, setLogEntries] = useState([]); // [{ id, attachment_id, title, filename, sizes, source }]
    const logScrollRef = useRef(null);

    // Slugs that get their own table column (FotoGrids plugin + custom sizes).
    const allSizeSlugs = [...pluginSizes, ...customSizes];

    // --------------------------------------------------------------
    // Loading + regeneration
    // --------------------------------------------------------------
    const loadStatus = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                include_unused: includeUnused ? '1' : '0',
                page: String(page),
                per_page: String(perPage),
            });
            const data = await apiFetch({
                path: `/fotogrids/v1/admin/tools/regenerate-thumbnails/status?${params.toString()}`,
            });
            setItems(data.items || []);
            setPluginSizes(data.plugin_sizes || []);
            setCustomSizes(data.custom_sizes || []);
            setOtherSizes(data.other_sizes || []);
            setTotalPages(data.total_pages || 1);
            setTotal(data.total || 0);
        } catch (err) {
            setError(err?.message || __('Failed to load status.', 'fotogrids'));
        } finally {
            setLoading(false);
        }
    }, [includeUnused, page, perPage]);

    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    // Reset page when toggling unused so we don't land on an out-of-range page.
    useEffect(() => {
        setPage(1);
    }, [includeUnused]);

    // Auto-scroll log to bottom as entries arrive.
    useEffect(() => {
        if (activeTab === 'log' && logScrollRef.current) {
            logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
        }
    }, [logEntries, activeTab]);

    const appendLogEntry = useCallback((item, result) => {
        setLogEntries(prev => [
            ...prev,
            {
                id: `${item.attachment_id}-${Date.now()}-${prev.length}`,
                attachment_id: item.attachment_id,
                title: item.title || item.filename,
                filename: item.filename,
                thumb_url: item.thumb_url,
                sizes: result.sizes,
                source: result.source,
                error: null,
            },
        ]);
    }, []);

    const appendLogError = useCallback((item, message) => {
        setLogEntries(prev => [
            ...prev,
            {
                id: `${item.attachment_id}-${Date.now()}-${prev.length}-err`,
                attachment_id: item.attachment_id,
                title: item.title || item.filename,
                filename: item.filename,
                thumb_url: item.thumb_url,
                sizes: null,
                source: null,
                error: message,
            },
        ]);
    }, []);

    const regenerateOne = useCallback(async (item) => {
        const attachmentId = item.attachment_id;
        setRegenItemId(attachmentId);
        try {
            const result = await apiFetch({
                path: '/fotogrids/v1/admin/tools/regenerate-thumbnails/regenerate',
                method: 'POST',
                data: { attachment_id: attachmentId },
            });

            setItems(prev => prev.map((it) => {
                if (it.attachment_id !== attachmentId) return it;
                return { ...it, sizes: result.sizes };
            }));

            appendLogEntry(item, result);
        } catch (err) {
            const message = err?.message || __('Unknown error.', 'fotogrids');
            console.warn(`FotoGrids: Error regenerating attachment ${attachmentId}:`, err);
            appendLogError(item, message);
        } finally {
            setRegenItemId(null);
        }
    }, [appendLogEntry, appendLogError]);

    const revealLogAndStart = useCallback(() => {
        setLogEntries([]);
        setLogVisible(true);
        setActiveTab('log');
    }, []);

    const handleRegenAll = useCallback(async () => {
        if (items.length === 0) return;
        revealLogAndStart();
        cancelledRef.current = false;
        setRegenActive(true);
        setRegenProgress({ done: 0, total: items.length });

        for (let i = 0; i < items.length; i++) {
            if (cancelledRef.current) break;
            await regenerateOne(items[i]);
            setRegenProgress({ done: i + 1, total: items.length });
        }

        setRegenActive(false);
        setRegenItemId(null);
    }, [items, regenerateOne, revealLogAndStart]);

    const handleRegenSingle = useCallback(async (item) => {
        revealLogAndStart();
        setRegenActive(true);
        setRegenProgress({ done: 0, total: 1 });
        await regenerateOne(item);
        setRegenProgress({ done: 1, total: 1 });
        setRegenActive(false);
    }, [regenerateOne, revealLogAndStart]);

    const handleCancel = useCallback(() => {
        cancelledRef.current = true;
    }, []);

    const niceSlug = (slug) => {
        if (slug === 'fotogrids_thumbnail') return __('FotoGrids Thumbnail', 'fotogrids');
        if (slug === 'fotogrids_full') return __('FotoGrids Full Image', 'fotogrids');
        return slug.replace(/^fotogrids_custom_/, '').replace(/_/g, ' ');
    };

    // --------------------------------------------------------------
    // Early-out states
    // --------------------------------------------------------------
    if (loading && items.length === 0) {
        return (
            <div className={`${baseClass}__loading`}>
                <span className={`spinner is-active ${baseClass}__loading-spinner`} />
                {__('Loading image data…', 'fotogrids')}
            </div>
        );
    }

    if (error) {
        return (
            <div className={`${baseClass}__error notice notice-error`}>
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

    const tabs = logVisible
        ? [
            { id: 'regenerate', icon: 'image', label: __('Regenerate', 'fotogrids') },
            { id: 'log',        icon: 'list',  label: __('Log', 'fotogrids') },
        ]
        : [
            { id: 'regenerate', icon: 'image', label: __('Regenerate', 'fotogrids') },
        ];

    return (
        <>
            <Panel
                title={__('Regenerate Thumbnails', 'fotogrids')}
                description={__('Lists every image used in your FotoGrids Galleries and shows which sizes exist for each. Use this after changing image sizes, switching themes, or fixing broken thumbnails - regenerate one image at a time, or run a full pass with Regenerate All.', 'fotogrids')}
                noBodyPadding
            >
                <TabBar
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </Panel>

            {activeTab === 'regenerate' && (
                <Panel equalBodyPadding>
                    <div className={`${baseClass}__toolbar`}>
                        <div className={`${baseClass}__toolbar-left`}>
                            {!regenActive ? (
                                <button
                                    className="fotogrids-button fotogrids-button--primary"
                                    onClick={handleRegenAll}
                                    disabled={items.length === 0}
                                >
                                    {__('Regenerate All', 'fotogrids')}
                                </button>
                            ) : (
                                <button className="fotogrids-button fotogrids-button--secondary" onClick={handleCancel}>
                                    {__('Cancel', 'fotogrids')}
                                </button>
                            )}
                            <Toggle
                                checked={includeUnused}
                                onChange={setIncludeUnused}
                                label={__('Show unused', 'fotogrids')}
                                description={__('Include images that aren’t in any FotoGrids gallery.', 'fotogrids')}
                                size="small"
                            />
                        </div>
                        <div className={`${baseClass}__toolbar-right`}>
                            <button
                                className={`fotogrids-button fotogrids-button--secondary ${baseClass}__refresh-btn`}
                                onClick={loadStatus}
                                disabled={regenActive}
                            >
                                <Icon name="refresh_cv" />
                                {__('Refresh Status', 'fotogrids')}
                            </button>
                        </div>
                    </div>

                    {items.length === 0 ? (
                        <p className={`${baseClass}__empty`}>
                            {includeUnused
                                ? __('No images found in the media library.', 'fotogrids')
                                : __('No gallery images found. Add images to a gallery first.', 'fotogrids')
                            }
                        </p>
                    ) : (
                        <>
                            <div className={`${baseClass}__table-wrap`}>
                                <table className={`wp-list-table widefat fixed striped ${baseClass}__table`}>
                                    <thead>
                                        <tr>
                                            <th className={`${baseClass}__col-file`}>{__('File', 'fotogrids')}</th>
                                            {allSizeSlugs.map(slug => (
                                                <th key={slug} className={`${baseClass}__col-size`}>
                                                    {niceSlug(slug)}
                                                </th>
                                            ))}
                                            {otherSizes.length > 0 && (
                                                <th className={`${baseClass}__col-other-sizes`}>
                                                    {__('Other registered sizes', 'fotogrids')}
                                                </th>
                                            )}
                                            <th className={`${baseClass}__col-action`}>{__('Action', 'fotogrids')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map(item => {
                                            const isBeingRegen = regenItemId === item.attachment_id;
                                            const rowClass = [
                                                isBeingRegen ? `${baseClass}__row--active` : '',
                                                includeUnused && item.in_gallery === false ? `${baseClass}__row--unused` : '',
                                            ].filter(Boolean).join(' ');
                                            return (
                                                <tr key={item.attachment_id} className={rowClass}>
                                                    <td className={`${baseClass}__col-file`}>
                                                        <div className={`${baseClass}__file`}>
                                                            <div className={`${baseClass}__file-thumb`}>
                                                                {item.thumb_url
                                                                    ? <img
                                                                        src={item.thumb_url}
                                                                        alt=""
                                                                        width="60"
                                                                        height="60"
                                                                        className={`${baseClass}__file-thumb-img`}
                                                                    />
                                                                    : <span className="dashicons dashicons-format-image" />
                                                                }
                                                            </div>
                                                            <div className={`${baseClass}__file-meta`}>
                                                                <span
                                                                    className={`${baseClass}__file-title`}
                                                                    title={item.title || item.filename}
                                                                >
                                                                    {item.title || item.filename}
                                                                </span>
                                                                <span
                                                                    className={`${baseClass}__file-name`}
                                                                    title={item.filename}
                                                                >
                                                                    {item.filename}
                                                                </span>
                                                                {includeUnused && item.in_gallery === false && (
                                                                    <span className={`${baseClass}__file-unused-badge`}>
                                                                        {__('Not in any gallery', 'fotogrids')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {allSizeSlugs.map(slug => (
                                                        <td key={slug} className={`${baseClass}__col-size`}>
                                                            <SizeStatus status={item.sizes?.[slug]} />
                                                        </td>
                                                    ))}
                                                    {otherSizes.length > 0 && (
                                                        <td className={`${baseClass}__col-other-sizes`}>
                                                            <OtherSizesCell slugs={otherSizes} sizes={item.sizes} />
                                                        </td>
                                                    )}
                                                    <td className={`${baseClass}__col-action`}>
                                                        {isBeingRegen ? (
                                                            <span className={`spinner is-active ${baseClass}__row-spinner`} />
                                                        ) : (
                                                            <button
                                                                className="fotogrids-button fotogrids-button--primary fotogrids-button--small"
                                                                onClick={() => handleRegenSingle(item)}
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

                            {totalPages > 1 && (
                                <div className={`${baseClass}__pagination`}>
                                    <button
                                        type="button"
                                        className="fotogrids-button fotogrids-button--secondary fotogrids-button--small"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page <= 1 || regenActive}
                                    >
                                        {__('← Prev', 'fotogrids')}
                                    </button>
                                    <span className={`${baseClass}__pagination-status`}>
                                        {sprintf(
                                            /* translators: 1: current page, 2: total pages, 3: total item count */
                                            __('Page %1$d of %2$d - %3$d items', 'fotogrids'),
                                            page,
                                            totalPages,
                                            total
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        className="fotogrids-button fotogrids-button--secondary fotogrids-button--small"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page >= totalPages || regenActive}
                                    >
                                        {__('Next →', 'fotogrids')}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </Panel>
            )}

            {activeTab === 'log' && logVisible && (
                <Panel equalBodyPadding>
                    <div className={`${baseClass}__log-header`}>
                        <div className={`${baseClass}__progress-wrap`}>
                            <div className={`${baseClass}__progress-bar`} style={{ width: `${progressPercent}%` }} />
                            <div className={`${baseClass}__progress-label`}>
                                <span className={`${baseClass}__progress-count`}>
                                    {regenProgress.done} / {regenProgress.total}
                                </span>
                                <span className={`${baseClass}__progress-percent`}>
                                    {progressPercent}%
                                </span>
                            </div>
                        </div>
                        {regenActive && (
                            <button
                                type="button"
                                className="fotogrids-button fotogrids-button--secondary fotogrids-button--small"
                                onClick={handleCancel}
                            >
                                {__('Cancel', 'fotogrids')}
                            </button>
                        )}
                    </div>

                    <div ref={logScrollRef} className={`${baseClass}__log`}>
                        {logEntries.length === 0 ? (
                            <p className={`${baseClass}__log-empty`}>
                                {__('Waiting for the first file…', 'fotogrids')}
                            </p>
                        ) : (
                            logEntries.map(entry => (
                                <LogEntry
                                    key={entry.id}
                                    entry={entry}
                                    pluginSizes={pluginSizes}
                                    customSizes={customSizes}
                                    otherSizes={otherSizes}
                                    niceSlug={niceSlug}
                                />
                            ))
                        )}
                    </div>
                </Panel>
            )}
        </>
    );
};

/**
 * A single log line: file header + per-size result list.
 */
const LogEntry = ({ entry, pluginSizes, customSizes, otherSizes, niceSlug }) => {
    if (entry.error) {
        return (
            <table className={`${baseClass}__log-entry ${baseClass}__log-entry--error`}>
                <tbody>
                    <tr className={`${baseClass}__log-entry-header-row`}>
                        <td colSpan={3} className={`${baseClass}__log-entry-header-cell`}>
                            <div className={`${baseClass}__log-entry-header`}>
                                <span className={`${baseClass}__log-entry-title`}>{entry.title}</span>
                                <span className={`${baseClass}__log-entry-filename`}>{entry.filename}</span>
                            </div>
                        </td>
                    </tr>
                    <tr className={`${baseClass}__log-size ${baseClass}__log-size--skipped`}>
                        <td colSpan={3} className={`${baseClass}__log-entry-error-cell`}>
                            <span className={`${baseClass}__log-size-mark`} aria-hidden="true">
                                <Icon name="alert_circle" />
                            </span>
                            {sprintf(
                                /* translators: %s: error message */
                                __('Regeneration failed: %s', 'fotogrids'),
                                entry.error
                            )}
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    }

    const allSlugs = [...pluginSizes, ...customSizes, ...otherSizes];

    return (
        <table className={`${baseClass}__log-entry`}>
            <tbody>
                <tr className={`${baseClass}__log-entry-header-row`}>
                    <td colSpan={3} className={`${baseClass}__log-entry-header-cell`}>
                        <div className={`${baseClass}__log-entry-header`}>
                            <span className={`${baseClass}__log-entry-title`}>{entry.title}</span>
                            <span className={`${baseClass}__log-entry-filename`}>{entry.filename}</span>
                            {entry.source?.width && entry.source?.height && (
                                <span className={`${baseClass}__log-entry-source`}>
                                    {entry.source.width}×{entry.source.height}
                                </span>
                            )}
                        </div>
                    </td>
                </tr>
                {allSlugs.map(slug => {
                    const status = entry.sizes?.[slug];
                    const exists = !!status?.exists;
                    const trailing = exists
                        ? (status.width && status.height
                            ? <span className={`${baseClass}__log-size-dims`}>
                                {status.width}×{status.height}
                            </span>
                            : null)
                        : (status?.reason
                            ? <span className={`${baseClass}__log-size-reason`}>
                                {status.reason}
                            </span>
                            : null);
                    return (
                        <tr
                            key={slug}
                            className={
                                exists
                                    ? `${baseClass}__log-size ${baseClass}__log-size--ok`
                                    : `${baseClass}__log-size ${baseClass}__log-size--skipped`
                            }
                        >
                            <td className={`${baseClass}__log-size-mark-cell`}>
                                <span className={`${baseClass}__log-size-mark`} aria-hidden="true">
                                    {exists ? <Icon name="check_circle" /> : <Icon name="alert_circle" />}
                                </span>
                            </td>
                            <td className={`${baseClass}__log-size-slug-cell`}>
                                <span className={`${baseClass}__log-size-slug`}>{niceSlug(slug)}</span>
                            </td>
                            <td className={`${baseClass}__log-size-trailing-cell`}>
                                {trailing}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

export default RegenerateThumbnailsTool;
