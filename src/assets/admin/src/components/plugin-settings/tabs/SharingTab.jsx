import React, { useState, useEffect, useMemo } from 'react';
import apiFetch from '@wordpress/api-fetch';
import {
    SettingsPanel,
    PanelRow,
    Segmented,
    SaveBar,
} from '../../shared/settings';
import Toggle from '../../shared/Toggle';
import ToggleList from '../../shared/ToggleList';

const { __ } = wp.i18n;

const NETWORKS = [
    { key: 'facebook', label: __('Facebook', 'fotogrids') },
    { key: 'x', label: __('X (Twitter)', 'fotogrids') },
    { key: 'pinterest', label: __('Pinterest', 'fotogrids') },
    { key: 'linkedin', label: __('LinkedIn', 'fotogrids') },
    { key: 'whatsapp', label: __('WhatsApp', 'fotogrids') },
    { key: 'telegram', label: __('Telegram', 'fotogrids') },
    { key: 'reddit', label: __('Reddit', 'fotogrids') },
    { key: 'email', label: __('Email', 'fotogrids') },
    { key: 'copy_link', label: __('Copy Link', 'fotogrids') },
];

const PLACEMENTS = [
    {
        key: 'view_page',
        label: __('View Page', 'fotogrids'),
        description: __('In the header or footer of a Gallery or Album\'s standalone view page.', 'fotogrids'),
    },
    {
        key: 'lightbox',
        label: __('Lightbox', 'fotogrids'),
        description: __('Inside Lightboxes.', 'fotogrids'),
    },
    {
        key: 'full_image',
        label: __('Full Image', 'fotogrids'),
        description: __('On the full-size image when items open directly.', 'fotogrids'),
    },
    {
        key: 'thumbnail',
        label: __('Thumbnails', 'fotogrids'),
        description: __('On each grid thumbnail, shown on hover, if enabled.', 'fotogrids'),
    },
];

const DEFAULTS = {
    enable_social_sharing: false,
    networks: {
        facebook: true, x: true, pinterest: true, linkedin: false,
        whatsapp: false, telegram: false, reddit: false, email: true, copy_link: true,
    },
    button_style: 'icons_only',
    button_size: 'medium',
    placements: ['view_page', 'lightbox'],
    custom_text: '',
    track_clicks: true,
    deep_linking_enabled: true,
    embedded_share_target: 'image',
};

const normalize = (raw) => {
    const seed = raw || {};
    return {
        ...DEFAULTS,
        ...seed,
        networks: { ...DEFAULTS.networks, ...(seed.networks || {}) },
        placements: Array.isArray(seed.placements) ? seed.placements : DEFAULTS.placements,
    };
};

/**
 * Plugin Settings → Sharing tab.
 *
 * Reads/writes the global fotogrids_sharing_settings option via
 * /fotogrids/v1/admin/sharing-settings. Drives sharing across the lightbox,
 * thumbnails and View pages; per-collection overrides layer on top elsewhere.
 */
const SharingTab = () => {
    const initial = normalize(window.fotogridsAdmin?.sharingSettings);

    const [settings, setSettings] = useState(initial);
    const [saved, setSaved] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        let active = true;
        apiFetch({ path: '/fotogrids/v1/admin/sharing-settings' })
            .then((data) => {
                if (!active || !data?.settings) return;
                const s = normalize(data.settings);
                setSettings(s);
                setSaved(s);
            })
            .catch(() => {});
        return () => { active = false; };
    }, []);

    const dirty = useMemo(
        () => JSON.stringify(settings) !== JSON.stringify(saved),
        [settings, saved]
    );

    const update = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setStatus(null);
    };

    const updateNetwork = (network, value) => {
        setSettings(prev => ({ ...prev, networks: { ...prev.networks, [network]: value } }));
        setStatus(null);
    };

    const togglePlacement = (placement, value) => {
        setSettings(prev => {
            const set = new Set(prev.placements);
            if (value) {
                set.add(placement);
            } else {
                set.delete(placement);
            }
            return { ...prev, placements: Array.from(set) };
        });
        setStatus(null);
    };

    const handleSave = async () => {
        setSaving(true);
        setStatus(null);
        try {
            const result = await apiFetch({
                path: '/fotogrids/v1/admin/sharing-settings',
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

    const enabled = settings.enable_social_sharing;

    return (
        <div className="fotogrids-sidebar-tabs__content__inner" key="sharing-content">
            <SettingsPanel
                title={__('Sharing', 'fotogrids')}
                description={__('Let visitors easily share and copy links to your Albums, Galleries and individual items. These settings apply site-wide; individual Galleries and Albums can override them.', 'fotogrids')}
            >
                <PanelRow
                    title={__('Enable sharing', 'fotogrids')}
                    description={__('Show share controls on Galleries, Albums and view pages.', 'fotogrids')}
                >
                    <Toggle
                        checked={enabled}
                        onChange={(v) => update('enable_social_sharing', v)}
                    />
                </PanelRow>
            </SettingsPanel>

            {enabled && (
                <>
                    <SettingsPanel
                        title={__('Networks', 'fotogrids')}
                        titleTag="h3"
                        description={__('Choose which share buttons to show.', 'fotogrids')}
                        equalBodyPadding
                    >
                        <ToggleList bigger noBorder>
                            {NETWORKS.map((n) => (
                                <Toggle
                                    key={n.key}
                                    checked={!!settings.networks[n.key]}
                                    onChange={(v) => updateNetwork(n.key, v)}
                                    label={n.label}
                                />
                            ))}
                        </ToggleList>
                    </SettingsPanel>

                    <SettingsPanel
                        title={__('Placement', 'fotogrids')}
                        titleTag="h3"
                        description={__('Where share controls can appear.', 'fotogrids')}
                    >
                        {PLACEMENTS.map((p) => (
                            <PanelRow key={p.key} title={p.label} description={p.description}>
                                <Toggle
                                    checked={settings.placements.includes(p.key)}
                                    onChange={(v) => togglePlacement(p.key, v)}
                                />
                            </PanelRow>
                        ))}
                    </SettingsPanel>

                    <SettingsPanel
                        title={__('Styling', 'fotogrids')}
                        titleTag="h3"
                        description={__('How the share buttons look.', 'fotogrids')}
                    >
                        <PanelRow title={__('Button style', 'fotogrids')}>
                            <Segmented
                                ariaLabel={__('Button style', 'fotogrids')}
                                value={settings.button_style}
                                onChange={(v) => update('button_style', v)}
                                options={[
                                    { value: 'icons_only', label: __('Icons only', 'fotogrids') },
                                    { value: 'icons_labels', label: __('Icons + labels', 'fotogrids') },
                                    { value: 'labels_only', label: __('Labels only', 'fotogrids') },
                                ]}
                            />
                        </PanelRow>
                        <PanelRow title={__('Button size', 'fotogrids')}>
                            <Segmented
                                ariaLabel={__('Button size', 'fotogrids')}
                                value={settings.button_size}
                                onChange={(v) => update('button_size', v)}
                                options={[
                                    { value: 'small', label: __('Small', 'fotogrids') },
                                    { value: 'medium', label: __('Medium', 'fotogrids') },
                                    { value: 'large', label: __('Large', 'fotogrids') },
                                ]}
                            />
                        </PanelRow>
                    </SettingsPanel>

                    <SettingsPanel
                        title={__('Deep linking', 'fotogrids')}
                        titleTag="h3"
                        description={__('Give each image a shareable link that reopens the gallery on that image.', 'fotogrids')}
                    >
                        <PanelRow
                            title={__('Enable deep linking', 'fotogrids')}
                            description={__('Sharing an image links to that specific image, not just the page.', 'fotogrids')}
                        >
                            <Toggle
                                checked={settings.deep_linking_enabled}
                                onChange={(v) => update('deep_linking_enabled', v)}
                            />
                        </PanelRow>
                        <PanelRow
                            title={__('Embedded galleries share', 'fotogrids')}
                            description={__('When a gallery is embedded in a page, choose what an image share links to.', 'fotogrids')}
                        >
                            <Segmented
                                ariaLabel={__('Embedded share target', 'fotogrids')}
                                value={settings.embedded_share_target}
                                onChange={(v) => update('embedded_share_target', v)}
                                options={[
                                    { value: 'image', label: __('The specific image', 'fotogrids') },
                                    { value: 'page', label: __('The page', 'fotogrids') },
                                ]}
                            />
                        </PanelRow>
                    </SettingsPanel>

                    <SettingsPanel
                        title={__('Advanced', 'fotogrids')}
                        titleTag="h3"
                    >
                        <PanelRow
                            title={__('Custom share text', 'fotogrids')}
                            description={__('Text included when sharing. Use {title} and {url} as placeholders.', 'fotogrids')}
                            htmlFor="fg-sharing-custom-text"
                        >
                            <input
                                id="fg-sharing-custom-text"
                                type="text"
                                className="fotogrids-text-input"
                                value={settings.custom_text}
                                placeholder={__('Check out {title} - {url}', 'fotogrids')}
                                onChange={(e) => update('custom_text', e.target.value)}
                            />
                        </PanelRow>
                        <PanelRow
                            title={__('Track share clicks', 'fotogrids')}
                            description={__('Record when visitors click a share button, for statistics.', 'fotogrids')}
                        >
                            <Toggle
                                checked={settings.track_clicks}
                                onChange={(v) => update('track_clicks', v)}
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

export default SharingTab;
