/**
 * InspectorGalleryPanel - read-only "what is this gallery / album"
 * summary, plus jump-out buttons.
 *
 * Lives inside `InspectorControls` on whichever host the block runs on.
 * Renders:
 *   - thumbnail + title + item count + last-modified date
 *   - Edit Gallery / Edit Album button (opens edit screen in a new tab)
 *   - Change Gallery / Change Album button (re-opens the picker)
 *   - Expandable read-only summary of the key gallery settings, to build
 *     the mental model "settings live with the gallery, not the block".
 */

import React, { useState } from 'react';
import { PanelBody, Button } from '@wordpress/components';
import { __, sprintf, _n } from '@wordpress/i18n';

const formatDate = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(
        document.documentElement.lang || undefined,
        { year: 'numeric', month: 'short', day: 'numeric' }
    ).format(date);
};

const InspectorGalleryPanel = ({
    item,
    kind,
    editUrl,
    onChange,
    settingsSummary,
}) => {
    const [showSettings, setShowSettings] = useState(false);
    const isAlbum = kind === 'album';

    const title = isAlbum
        ? __('Album', 'fotogrids')
        : __('Gallery', 'fotogrids');

    if (!item) {
        return (
            <PanelBody title={title} initialOpen={true}>
                <p>
                    {isAlbum
                        ? __('No album selected yet.', 'fotogrids')
                        : __('No gallery selected yet.', 'fotogrids')
                    }
                </p>
            </PanelBody>
        );
    }

    const countLabel = isAlbum
        ? sprintf(
            /* translators: %d: gallery count */
            _n('%d gallery', '%d galleries', item.item_count, 'fotogrids'),
            item.item_count
        )
        : sprintf(
            /* translators: %d: image count */
            _n('%d image', '%d images', item.item_count, 'fotogrids'),
            item.item_count
        );

    return (
        <PanelBody title={title} initialOpen={true}>
            <div className="fg-pb-inspector-summary">
                {item.featured_thumb && (
                    <img
                        className="fg-pb-inspector-summary__thumb"
                        src={item.featured_thumb}
                        alt=""
                    />
                )}
                <div className="fg-pb-inspector-summary__text">
                    <strong>{item.title || __('(no title)', 'fotogrids')}</strong>
                    <div className="fg-pb-inspector-summary__meta">
                        <span>{countLabel}</span>
                        {item.updated_at && (
                            <span>{sprintf(
                                /* translators: %s: date */
                                __('Updated %s', 'fotogrids'),
                                formatDate(item.updated_at)
                            )}</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="fg-pb-inspector-actions">
                {editUrl && (
                    <Button
                        variant="secondary"
                        href={editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {isAlbum
                            ? __('Edit album', 'fotogrids')
                            : __('Edit gallery', 'fotogrids')
                        }
                    </Button>
                )}
                {onChange && (
                    <Button variant="tertiary" onClick={onChange}>
                        {isAlbum
                            ? __('Change album', 'fotogrids')
                            : __('Change gallery', 'fotogrids')
                        }
                    </Button>
                )}
            </div>

            {settingsSummary && settingsSummary.length > 0 && (
                <div className="fg-pb-inspector-settings">
                    <Button
                        variant="link"
                        onClick={() => setShowSettings((v) => !v)}
                    >
                        {showSettings
                            ? __('Hide gallery settings used', 'fotogrids')
                            : __('Show gallery settings used', 'fotogrids')
                        }
                    </Button>
                    {showSettings && (
                        <ul className="fg-pb-inspector-settings__list">
                            {settingsSummary.map((entry) => (
                                <li key={entry.label}>
                                    <span className="fg-pb-inspector-settings__label">
                                        {entry.label}
                                    </span>
                                    <span className="fg-pb-inspector-settings__value">
                                        {entry.value}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </PanelBody>
    );
};

export default InspectorGalleryPanel;
