import React, { useState, useEffect, useMemo } from 'react';
import apiFetch from '@wordpress/api-fetch';
import {
    SettingsPanel,
    PanelRow,
    DimensionsField,
    NumberField,
    Segmented,
    SaveBar,
} from '../../shared/settings';
import Select from '../../shared/Select';

const { __ } = wp.i18n;

/**
 * Plugin Settings → Media tab.
 *
 * Configures the two plugin-wide FotoGrids image sizes:
 *   - fotogrids_thumbnail (gallery grid)
 *   - fotogrids_full      (lightbox)
 *
 * Saves via /fotogrids/v1/admin/media-settings and surfaces a read-only list
 * of gallery-custom sizes. Composed entirely from the shared settings
 * primitives.
 */
const MediaTab = () => {
    const regenUrl = 'admin.php?page=fotogrids-tools&tool=regenerate-thumbnails';

    const [settings, setSettings] = useState(null);
    const [saved, setSaved] = useState(null); // last-persisted snapshot for dirty tracking
    const [customSizes, setCustomSizes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null); // 'saved' | 'error' | null
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await apiFetch({ path: '/fotogrids/v1/admin/media-settings' });
                setSettings(data.settings || {});
                setSaved(data.settings || {});
                setCustomSizes(data.custom_sizes || []);
            } catch (err) {
                setError(err?.message || __('Failed to load media settings.', 'fotogrids'));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const dirty = useMemo(
        () => JSON.stringify(settings) !== JSON.stringify(saved),
        [settings, saved]
    );

    const update = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setStatus(null);
    };

    const handleSave = async () => {
        setSaving(true);
        setStatus(null);
        try {
            const result = await apiFetch({
                path: '/fotogrids/v1/admin/media-settings',
                method: 'POST',
                data: settings,
            });
            const next = result.settings || settings;
            setSettings(next);
            setSaved(next);
            setStatus('saved');
            setTimeout(() => setStatus(null), 3000);
        } catch (err) {
            setStatus('error');
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => {
        setSettings(saved);
        setStatus(null);
    };

    if (loading) {
        return (
            <div className="fg-media-tab__loading">
                <span className="spinner is-active" style={{ float: 'none', marginTop: 0 }} />
                {' '}{__('Loading…', 'fotogrids')}
            </div>
        );
    }

    if (error) {
        return (
            <div className="notice notice-error"><p>{error}</p></div>
        );
    }

    const thumbCrop = settings?.thumbnail_crop ?? true;
    const fullWidth = settings?.full_width ?? 1920;
    const mobileCompanion = Math.max(1, Math.floor(fullWidth / 2));

    const alignmentOptions = [
        { value: 'top-left',     label: __('Top Left', 'fotogrids') },
        { value: 'top',          label: __('Top Center', 'fotogrids') },
        { value: 'top-right',    label: __('Top Right', 'fotogrids') },
        { value: 'left',         label: __('Center Left', 'fotogrids') },
        { value: 'center',       label: __('Center', 'fotogrids') },
        { value: 'right',        label: __('Center Right', 'fotogrids') },
        { value: 'bottom-left',  label: __('Bottom Left', 'fotogrids') },
        { value: 'bottom',       label: __('Bottom Center', 'fotogrids') },
        { value: 'bottom-right', label: __('Bottom Right', 'fotogrids') },
    ];

    return (
        <div className="fotogrids-sidebar-tabs__content__inner fg-media-tab" key="media-content">
            <SettingsPanel
                title={__('Gallery thumbnails', 'fotogrids')}
                description={__('The size used in the gallery grid. Changing these requires regenerating thumbnails for existing images.', 'fotogrids')}
                action={
                    <a href={regenUrl} className="fotogrids-button fotogrids-button--secondary fotogrids-button--small">
                        {__('Regenerate', 'fotogrids')}
                    </a>
                }
            >
                <PanelRow
                    title={__('Dimensions', 'fotogrids')}
                    description={__('Width and height in pixels. Used for every grid thumbnail.', 'fotogrids')}
                >
                    <DimensionsField
                        idPrefix="fg-thumb"
                        width={settings?.thumbnail_width ?? 400}
                        height={settings?.thumbnail_height ?? 300}
                        onWidthChange={(v) => update('thumbnail_width', Math.max(1, v))}
                        onHeightChange={(v) => update('thumbnail_height', Math.max(0, v))}
                        min={0}
                        max={2000}
                    />
                </PanelRow>

                <PanelRow
                    title={__('Crop mode', 'fotogrids')}
                    description={__('Hard crop forces every thumbnail to the exact dimensions. Soft crop keeps the original aspect ratio.', 'fotogrids')}
                >
                    <Segmented
                        ariaLabel={__('Crop mode', 'fotogrids')}
                        value={thumbCrop ? 'hard' : 'soft'}
                        onChange={(v) => update('thumbnail_crop', v === 'hard')}
                        options={[
                            { value: 'hard', label: __('Hard crop', 'fotogrids'), icon: 'square' },
                            { value: 'soft', label: __('Soft crop', 'fotogrids'), icon: 'image' },
                        ]}
                    />
                    {thumbCrop && (
                        <div style={{ marginTop: 16, maxWidth: 220 }}>
                            <label
                                className="fotogrids-dimensions-field__label"
                                style={{ display: 'block', marginBottom: 6 }}
                            >
                                {__('Crop alignment', 'fotogrids')}
                            </label>
                            <Select
                                value={settings?.thumbnail_alignment ?? 'center'}
                                onChange={(v) => update('thumbnail_alignment', v)}
                                options={alignmentOptions}
                            />
                        </div>
                    )}
                </PanelRow>

            </SettingsPanel>

            <SettingsPanel
                title={__('Lightbox image', 'fotogrids')}
                description={__('The full-size image shown in the Lightbox. Always proportional - never hard-cropped.', 'fotogrids')}
            >
                <PanelRow
                    title={__('Max width', 'fotogrids')}
                    description={__('A companion mobile size at half this width is generated automatically.', 'fotogrids')}
                    htmlFor="fg-full-width"
                >
                    <NumberField
                        id="fg-full-width"
                        value={fullWidth}
                        onChange={(v) => update('full_width', Math.max(1, v))}
                        unit="px"
                        min={1}
                        max={8000}
                        help={
                            <>
                                {__('Mobile companion:', 'fotogrids')}{' '}
                                <strong>{mobileCompanion} px</strong>
                                {' - '}{__('generated automatically.', 'fotogrids')}
                            </>
                        }
                    />
                </PanelRow>

                <PanelRow
                    title={__('Max height', 'fotogrids')}
                    description={__('Optional. Leave at 0 to keep images proportional.', 'fotogrids')}
                    htmlFor="fg-full-height"
                >
                    <NumberField
                        id="fg-full-height"
                        value={settings?.full_height ?? 0}
                        onChange={(v) => update('full_height', Math.max(0, v))}
                        unit="px"
                        min={0}
                        max={8000}
                        help={__('0 = proportional (recommended)', 'fotogrids')}
                    />
                </PanelRow>
            </SettingsPanel>

            {customSizes.length > 0 && (
                <SettingsPanel
                    title={__('Gallery-custom sizes', 'fotogrids')}
                    description={__('These sizes were created by individual gallery settings. They cannot be edited here.', 'fotogrids')}
                >
                    <table className="widefat striped" style={{ marginTop: 8 }}>
                        <thead>
                            <tr>
                                <th>{__('Slug', 'fotogrids')}</th>
                                <th>{__('Dimensions', 'fotogrids')}</th>
                                <th>{__('Crop', 'fotogrids')}</th>
                                <th>{__('Galleries', 'fotogrids')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customSizes.map(size => (
                                <tr key={size.slug}>
                                    <td><code>{size.slug}</code></td>
                                    <td>{size.width}×{size.height === 0 ? '?' : size.height}</td>
                                    <td>{size.crop ? __('Yes', 'fotogrids') : __('No', 'fotogrids')}</td>
                                    <td>{(size.gallery_ids || []).length}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </SettingsPanel>
            )}

            <SaveBar
                dirty={dirty}
                saving={saving}
                status={status}
                onSave={handleSave}
                onDiscard={handleDiscard}
                extraAction={
                    <a href={regenUrl} className="fotogrids-button fotogrids-button--secondary fotogrids-button--small">
                        {__('Regenerate thumbnails', 'fotogrids')}
                    </a>
                }
            />
        </div>
    );
};

export default MediaTab;
