import React, { useMemo } from 'react';
import Icon from '../../shared/Icon';
import Tooltip from '../../Tooltip';
import { Button } from '../../shared/Button';
import { copyToClipboard } from '../../../utils/copy-to-clipboard';

const PREVIEW_WIDTH_LIMIT = 1200;
const REGENERATE_TOOL_URL = 'admin.php?page=fotogrids-tools&tool=regenerate-thumbnails';
const REGENERABLE_STATUSES = ['not_generated', 'missing_file'];

const sourceLabel = (source, strings) => {
    const labels = {
        fotogrids: strings.mediaSourceFotoGrids,
        core: strings.mediaSourceCore,
        theme: strings.mediaSourceTheme,
    };

    return labels[source] || '';
};

const statusLabel = (status, strings) => {
    const labels = {
        not_generated: strings.mediaSizeNotGenerated,
        missing_file: strings.mediaSizeFileMissing,
        source_too_small: strings.mediaSizeSourceTooSmall,
    };

    return labels[status] || '';
};

const TabMedia = ({ itemData, loading, strings = {}, disabled = false }) => {
    const sizes = useMemo(() => {
        const list = Array.isArray(itemData?.media_sizes) ? [...itemData.media_sizes] : [];

        return list.sort((a, b) => (a.width || 0) - (b.width || 0));
    }, [itemData]);

    const availableCount = sizes.filter((size) => 'generated' === size.status).length;

    const handleCopy = async (url) => {
        try {
            await copyToClipboard(url);
            window.fotogridsToast?.success(strings.urlCopied, 1500);
        } catch (error) {
            window.fotogridsToast?.error(strings.copyFailed);
        }
    };

    if (loading) {
        return (
            <div className="fotogrids-tab-panel fg-is-active">
                <div className="fotogrids-edit-item-media-sizes__empty">{strings.loading}</div>
            </div>
        );
    }

    if (0 === sizes.length) {
        return (
            <div className="fotogrids-tab-panel fg-is-active">
                <div className="fotogrids-edit-item-media-sizes__empty">
                    {strings.mediaSizesEmpty}
                </div>
            </div>
        );
    }

    return (
        <div className="fotogrids-tab-panel fg-is-active">
            <div className="fotogrids-edit-item-media-sizes">
                <p className="fotogrids-edit-item-media-sizes__summary">
                    {strings.mediaSizesSummary
                        ?.replace('%1$s', String(availableCount))
                        .replace('%2$s', String(sizes.length))}
                </p>

                <div className="fotogrids-edit-item-media-sizes__grid">
                    {sizes.map((size) => {
                        const isAvailable = 'generated' === size.status;
                        const canRegenerate = REGENERABLE_STATUSES.includes(size.status);
                        const canOpen = isAvailable && '' !== size.url;
                        const badge = statusLabel(size.status, strings);
                        const previewUrl = (size.width || 0) > PREVIEW_WIDTH_LIMIT
                            ? (itemData?.medium_url || size.url)
                            : size.url;

                        return (
                            <div
                                key={size.name}
                                className={`fotogrids-edit-item-media-size ${ isAvailable ? '' : 'fotogrids-edit-item-media-size--unavailable' }`.trim()}
                            >
                                <div className="fotogrids-edit-item-media-size__thumb">
                                    {isAvailable && previewUrl ? (
                                        <img src={previewUrl} alt="" loading="lazy" />
                                    ) : (
                                        <Icon name="image_x" />
                                    )}
                                </div>

                                <div className="fotogrids-edit-item-media-size__meta">
                                    <span className="fotogrids-edit-item-media-size__label">{size.label}</span>
                                    <span className="fotogrids-edit-item-media-size__slug">
                                        <code>{size.name}</code>
                                        {sourceLabel(size.source, strings) && (
                                            <em className="fotogrids-edit-item-media-size__source">
                                                {sourceLabel(size.source, strings)}
                                            </em>
                                        )}
                                    </span>
                                    <span className="fotogrids-edit-item-media-size__dims">
                                        {size.width || '?'} × {size.height || '?'}
                                        {size.crop ? ` · ${ strings.mediaSizeCropped }` : ''}
                                        {size.filesize ? ` · ${ size.filesize }` : ''}
                                    </span>
                                    {badge && (
                                        <span className="fotogrids-edit-item-media-size__badge">{badge}</span>
                                    )}
                                </div>

                                {(canRegenerate || canOpen) && (
                                    <div className="fotogrids-edit-item-media-size__actions">
                                        {canRegenerate && (
                                            <Tooltip content={strings.regenerateThumbnails}>
                                                <Button
                                                    variant="secondary"
                                                    style="ghost"
                                                    size="sm"
                                                    icon="image"
                                                    iconOnly
                                                    href={REGENERATE_TOOL_URL}
                                                    target="_blank"
                                                    ariaLabel={strings.regenerateThumbnails}
                                                />
                                            </Tooltip>
                                        )}

                                        {canOpen && (
                                            <>
                                                <Tooltip content={strings.copyUrl}>
                                                    <Button
                                                        variant="secondary"
                                                        style="ghost"
                                                        size="sm"
                                                        icon="link"
                                                        iconOnly
                                                        disabled={disabled}
                                                        ariaLabel={strings.copyUrl}
                                                        onClick={() => handleCopy(size.url)}
                                                    />
                                                </Tooltip>
                                                <Tooltip content={strings.openInNewTab}>
                                                    <Button
                                                        variant="secondary"
                                                        style="ghost"
                                                        size="sm"
                                                        icon="eye"
                                                        iconOnly
                                                        href={size.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        ariaLabel={strings.openInNewTab}
                                                    />
                                                </Tooltip>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TabMedia;
