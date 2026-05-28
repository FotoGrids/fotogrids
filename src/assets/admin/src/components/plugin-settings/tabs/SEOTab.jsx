import React, { useState, useEffect, useMemo, useRef } from 'react';
import apiFetch from '@wordpress/api-fetch';
import {
    SettingsPanel,
    PanelRow,
    Segmented,
    SaveBar,
} from '../../shared/settings';
import Toggle from '../../shared/Toggle';

const { __ } = wp.i18n;

const DEFAULTS = {
    enable_open_graph:    true,
    enable_twitter_card:  true,
    og_type_default:      'article',
    defer_to_seo_plugins: false,
    default_og_image_id:  0,
    facebook_app_id:      '',
    twitter_handle:       '',
};

const normalize = (raw) => ({ ...DEFAULTS, ...(raw || {}) });

/**
 * Plugin Settings → SEO tab.
 *
 * Reads/writes the site-wide fotogrids_seo_settings option via
 * /fotogrids/v1/admin/seo-settings. These are the defaults that flow
 * into every view page; per-collection overrides (og_title, og_description,
 * og_image_source/custom, noindex, canonical_override) live in the SEO
 * tab of the individual gallery / album editor.
 */
const SEOTab = () => {
    const initial = normalize(window.fotogridsAdmin?.seoSettings);

    const [settings, setSettings] = useState(initial);
    const [saved, setSaved] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const mediaFrameRef = useRef(null);

    useEffect(() => {
        let active = true;
        apiFetch({ path: '/fotogrids/v1/admin/seo-settings' })
            .then((data) => {
                if (!active || !data?.settings) return;
                const s = normalize(data.settings);
                setSettings(s);
                setSaved(s);
            })
            .catch(() => {});
        return () => { active = false; };
    }, []);

    // Resolve a thumbnail URL for whatever `default_og_image_id` happens to
    // be when the tab loads (or after a save round-trip). The picker stores
    // only the attachment ID; the preview asks the WP REST media endpoint
    // for a thumbnail URL on demand so we don't have to bootstrap it.
    useEffect(() => {
        const id = settings.default_og_image_id;
        if (!id) {
            setImagePreview(null);
            return;
        }
        let active = true;
        apiFetch({ path: `/wp/v2/media/${id}` })
            .then((media) => {
                if (!active) return;
                const url = media?.media_details?.sizes?.medium?.source_url
                    || media?.source_url
                    || null;
                setImagePreview(url);
            })
            .catch(() => active && setImagePreview(null));
        return () => { active = false; };
    }, [settings.default_og_image_id]);

    const dirty = useMemo(
        () => JSON.stringify(settings) !== JSON.stringify(saved),
        [settings, saved]
    );

    const update = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setStatus(null);
    };

    const openMediaPicker = () => {
        if (typeof wp === 'undefined' || typeof wp.media === 'undefined') {
            return;
        }
        if (!mediaFrameRef.current) {
            mediaFrameRef.current = wp.media({
                title: __('Choose default OG image', 'fotogrids'),
                button: { text: __('Use this image', 'fotogrids') },
                multiple: false,
                library: { type: 'image' },
            });
            mediaFrameRef.current.on('select', () => {
                const attachment = mediaFrameRef.current.state().get('selection').first().toJSON();
                update('default_og_image_id', attachment.id);
            });
        }
        mediaFrameRef.current.open();
    };

    const clearImage = () => update('default_og_image_id', 0);

    const handleSave = async () => {
        setSaving(true);
        setStatus(null);
        try {
            const result = await apiFetch({
                path: '/fotogrids/v1/admin/seo-settings',
                method: 'POST',
                data: settings,
            });
            const next = result?.settings ? normalize(result.settings) : settings;
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

    const ogEnabled = settings.enable_open_graph && !settings.defer_to_seo_plugins;

    return (
        <div className="fotogrids-sidebar-tabs__content__inner" key="seo-content">
            <SettingsPanel
                title={__('SEO', 'fotogrids')}
                description={__('Defaults applied to every Gallery and Album view page. Individual collections can override the per-page fields from the SEO tab in their editor.', 'fotogrids')}
            >
                <PanelRow
                    title={__('Defer to other SEO plugins', 'fotogrids')}
                    description={__('Hand the view page over to Yoast, RankMath, AIOSEO or SEOPress instead of emitting tags from FotoGrids.', 'fotogrids')}
                    largerLabels
                >
                    <Toggle
                        label={__('Defer', 'fotogrids')}
                        checked={settings.defer_to_seo_plugins}
                        onChange={(v) => update('defer_to_seo_plugins', v)}
                        description={__('Off by default — FotoGrids owns the meta on view pages and automatically silences the other plugins to prevent duplicates.', 'fotogrids')}
                    />
                </PanelRow>
                <PanelRow
                    title={__('Enable Open Graph tags', 'fotogrids')}
                    description={__('Emits `og:title` `og:description` `og:image` `og:url` and `og:type` so Facebook, LinkedIn, WhatsApp and iMessage can render rich previews.', 'fotogrids')}
                    largerLabels
                >
                    <Toggle
                        label={__('Enable', 'fotogrids')}
                        checked={settings.enable_open_graph}
                        onChange={(v) => update('enable_open_graph', v)}
                        disabled={settings.defer_to_seo_plugins}
                    />
                </PanelRow>
                <PanelRow
                    title={__('Enable Twitter / X cards', 'fotogrids')}
                    description={__('Emits `twitter:card` `twitter:image` and `twitter:title` alongside the OG tags. Slack and X prefer these over OG.', 'fotogrids')}
                    largerLabels
                >
                    <Toggle
                        label={__('Enable', 'fotogrids')}
                        checked={settings.enable_twitter_card}
                        onChange={(v) => update('enable_twitter_card', v)}
                        disabled={settings.defer_to_seo_plugins}
                    />
                </PanelRow>
            </SettingsPanel>

            {ogEnabled && (
                <>
                    <SettingsPanel
                        title={__('Defaults', 'fotogrids')}
                        titleTag="h3"
                        description={__('Site-wide defaults used when a collection has no per-page override.', 'fotogrids')}
                    >
                        <PanelRow
                            title={__('Default OG type', 'fotogrids')}
                            description={__('`article` suits most photography work; `website` suits evergreen portfolios.', 'fotogrids')}
                            largerLabels
                        >
                            <Segmented
                                ariaLabel={__('Default OG type', 'fotogrids')}
                                value={settings.og_type_default}
                                onChange={(v) => update('og_type_default', v)}
                                options={[
                                    { value: 'article', label: __('Article', 'fotogrids') },
                                    { value: 'website', label: __('Website', 'fotogrids') },
                                ]}
                            />
                        </PanelRow>
                        <PanelRow
                            title={__('Default OG image', 'fotogrids')}
                            description={__('Fallback when a collection has no Featured Item, no Featured Gallery, and no custom image. Recommended size: 1200×630px.', 'fotogrids')}
                            largerLabels
                        >
                            <div className="fotogrids-seo-image-picker">
                                {imagePreview ? (
                                    <img
                                        src={imagePreview}
                                        alt=""
                                        style={{ maxWidth: 200, maxHeight: 120, display: 'block', marginBottom: 8 }}
                                    />
                                ) : null}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        type="button"
                                        className="fotogrids-button fotogrids-button--secondary fotogrids-button--small"
                                        onClick={openMediaPicker}
                                    >
                                        {settings.default_og_image_id ? __('Replace image', 'fotogrids') : __('Choose image', 'fotogrids')}
                                    </button>
                                    {settings.default_og_image_id ? (
                                        <button
                                            type="button"
                                            className="fotogrids-button fotogrids-button--ghost fotogrids-button--small"
                                            onClick={clearImage}
                                        >
                                            {__('Remove', 'fotogrids')}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </PanelRow>
                    </SettingsPanel>

                    <SettingsPanel
                        title={__('Platform IDs', 'fotogrids')}
                        titleTag="h3"
                        description={__('Optional metadata used by some platforms to attribute shares to your account.', 'fotogrids')}
                    >
                        <PanelRow
                            title={__('Facebook App ID', 'fotogrids')}
                            description={__('Emits `fb:app_id`. Needed if you use Facebook Insights to track shares.', 'fotogrids')}
                            htmlFor="fg-seo-fb-app-id"
                        >
                            <input
                                id="fg-seo-fb-app-id"
                                type="text"
                                className="fotogrids-input fotogrids-input--inline"
                                value={settings.facebook_app_id}
                                placeholder=""
                                onChange={(e) => update('facebook_app_id', e.target.value)}
                            />
                        </PanelRow>
                        <PanelRow
                            title={__('Twitter / X handle', 'fotogrids')}
                            description={__('Emits `twitter:site`. The `@` is added automatically if you leave it off.', 'fotogrids')}
                            htmlFor="fg-seo-twitter-handle"
                        >
                            <input
                                id="fg-seo-twitter-handle"
                                type="text"
                                className="fotogrids-input fotogrids-input--inline"
                                value={settings.twitter_handle}
                                placeholder="@yoursite"
                                onChange={(e) => update('twitter_handle', e.target.value)}
                            />
                        </PanelRow>
                    </SettingsPanel>
                </>
            )}

            <SaveBar
                dirty={dirty}
                saving={saving}
                status={status}
                onSave={handleSave}
                onDiscard={handleDiscard}
            />
        </div>
    );
};

export default SEOTab;
