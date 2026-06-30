import React, { useState, useEffect, useMemo } from 'react';
import apiFetch from '@wordpress/api-fetch';
import {
    SettingsPanel,
    PanelRow,
    Segmented,
    NumberField,
    SaveBar,
} from '../../shared/settings';
import Toggle from '../../shared/Toggle';

const { __ } = wp.i18n;

// Keep aligned with View_Settings_Store::defaults() in
// Plugin/src/includes/settings/class-view-settings-store.php.
const DEFAULTS = {
    layout_mode: 'integrated',

    // Standalone-only appearance.
    accent_color: '#3c46f0',
    theme: 'light',
    max_width: 1200,
    show_header: true,
    show_footer: true,

    // Integrated-mode toggles.
    integrated_show_title_block: false,
    integrated_hide_featured_image: true,
    integrated_allow_comments: false,
    integrated_include_in_archives: false,
    integrated_post_navigation: false,
};

const normalize = (raw) => ({ ...DEFAULTS, ...(raw || {}) });

/**
 * Plugin Settings → View Pages tab.
 *
 * Reads/writes the global fotogrids_view_settings option via
 * /fotogrids/v1/admin/view-settings.
 *
 * Two layout modes share this tab:
 *  - Integrated (default): the gallery is a normal post in the active theme.
 *    The theme owns header/footer/sidebar; FotoGrids contributes the gallery
 *    markup, document title, head meta, body classes and asset enqueues via
 *    standard WP hooks. Five behavioural toggles control the post-style
 *    integration (title block, featured image, comments, archives,
 *    previous/next navigation).
 *  - Standalone: the legacy theme-less shell. Accent colour, light/dark theme,
 *    max width and the inline page header live here.
 *
 * Only the group relevant to the active layout mode is rendered; the other
 * group's settings are still persisted and surfaced when the mode flips.
 */
const ViewPagesTab = () => {
    const [settings, setSettings] = useState(normalize(window.fotogridsAdmin?.viewSettings));
    const [saved, setSaved] = useState(normalize(window.fotogridsAdmin?.viewSettings));
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        let active = true;
        apiFetch({ path: '/fotogrids/v1/admin/view-settings' })
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

    const handleSave = async () => {
        setSaving(true);
        setStatus(null);
        try {
            const result = await apiFetch({
                path: '/fotogrids/v1/admin/view-settings',
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

    // Reuse the plugin's existing color picker widget (plain global) by passing
    // a synthetic setting descriptor.
    const renderAccentPicker = () => {
        const renderer = window.FotoGridsRenderSettings?.renderColorPicker;
        if (!renderer) {
            return (
                <input
                    type="color"
                    value={settings.accent_color}
                    onChange={(e) => update('accent_color', e.target.value)}
                />
            );
        }
        return renderer(
            { key: 'accent_color', default: DEFAULTS.accent_color },
            settings.accent_color,
            false,
            {
                updateSetting: (key, value) => update('accent_color', value),
                getFieldState: () => 'editable',
                __,
            }
        );
    };

    const isIntegrated = settings.layout_mode === 'integrated';

    return (
        <div className="fotogrids-sidebar-tabs__content__inner" key="view-pages-content">
            <SettingsPanel
                title={__('Page layout', 'fotogrids')}
                description={__('Choose how view pages render. Integrated treats each gallery or album as a normal post in your theme. Standalone renders a theme-less shell that owns the whole page.', 'fotogrids')}
            >
                <PanelRow
                    title={__('Layout mode', 'fotogrids')}
                    description={__('Integrated uses your theme’s header, footer and navigation. Standalone overrides the theme entirely.', 'fotogrids')}
                >
                    <Segmented
                        ariaLabel={__('Layout mode', 'fotogrids')}
                        value={settings.layout_mode}
                        onChange={(v) => update('layout_mode', v)}
                        options={[
                            { value: 'integrated', label: __('Integrated', 'fotogrids') },
                            { value: 'standalone', label: __('Standalone', 'fotogrids') },
                        ]}
                    />
                </PanelRow>
            </SettingsPanel>

            {isIntegrated && (
                <SettingsPanel
                    title={__('Integrated view pages', 'fotogrids')}
                    description={__('Behaviour for view pages rendered inside your theme. These settings control how the gallery acts as a normal post on your site.', 'fotogrids')}
                >
                    <PanelRow
                        title={__('Show title block above gallery', 'fotogrids')}
                        description={__('Display the FotoGrids title and item count above the gallery. Most themes already render the post title, so this is off by default.', 'fotogrids')}
                    >
                        <Toggle
                            checked={settings.integrated_show_title_block}
                            onChange={(v) => update('integrated_show_title_block', v)}
                        />
                    </PanelRow>

                    <PanelRow
                        title={__('Hide featured image', 'fotogrids')}
                        description={__('Suppress your theme’s featured-image render on view pages. The gallery is the visual content, so an extra featured image above it is usually redundant.', 'fotogrids')}
                    >
                        <Toggle
                            checked={settings.integrated_hide_featured_image}
                            onChange={(v) => update('integrated_hide_featured_image', v)}
                        />
                    </PanelRow>

                    <PanelRow
                        title={__('Allow comments', 'fotogrids')}
                        description={__('Let visitors leave comments on view pages if your theme renders them.', 'fotogrids')}
                    >
                        <Toggle
                            checked={settings.integrated_allow_comments}
                            onChange={(v) => update('integrated_allow_comments', v)}
                        />
                    </PanelRow>

                    <PanelRow
                        title={__('Include in author and date archives', 'fotogrids')}
                        description={__('When on, view pages appear in your theme’s author and date archives alongside blog posts.', 'fotogrids')}
                    >
                        <Toggle
                            checked={settings.integrated_include_in_archives}
                            onChange={(v) => update('integrated_include_in_archives', v)}
                        />
                    </PanelRow>

                    <PanelRow
                        title={__('Previous / next navigation', 'fotogrids')}
                        description={__('When on, previous/next post links on view pages stay within galleries or within albums. When off, navigation is suppressed.', 'fotogrids')}
                    >
                        <Toggle
                            checked={settings.integrated_post_navigation}
                            onChange={(v) => update('integrated_post_navigation', v)}
                        />
                    </PanelRow>
                </SettingsPanel>
            )}

            {!isIntegrated && (
                <SettingsPanel
                    title={__('Standalone appearance', 'fotogrids')}
                    description={__('Look and feel of the theme-less shell. These settings apply to every Standalone view page.', 'fotogrids')}
                >
                    <PanelRow
                        title={__('Accent color', 'fotogrids')}
                        description={__('Used for buttons, links and highlights.', 'fotogrids')}
                    >
                        {renderAccentPicker()}
                    </PanelRow>

                    <PanelRow
                        title={__('Theme', 'fotogrids')}
                        description={__('The base colour scheme.', 'fotogrids')}
                    >
                        <Segmented
                            ariaLabel={__('Theme', 'fotogrids')}
                            value={settings.theme}
                            onChange={(v) => update('theme', v)}
                            options={[
                                { value: 'light', label: __('Light', 'fotogrids') },
                                { value: 'dark', label: __('Dark', 'fotogrids') },
                            ]}
                        />
                    </PanelRow>

                    <PanelRow
                        title={__('Maximum width', 'fotogrids')}
                        description={__('How wide the gallery content can grow on large screens.', 'fotogrids')}
                        htmlFor="fg-view-max-width"
                    >
                        <NumberField
                            id="fg-view-max-width"
                            value={settings.max_width}
                            onChange={(v) => update('max_width', v)}
                            unit="px"
                            min={320}
                            max={3000}
                            step={10}
                        />
                    </PanelRow>

                    <PanelRow
                        title={__('Show page header', 'fotogrids')}
                        description={__('Display the title and item count at the top of the view page.', 'fotogrids')}
                    >
                        <Toggle
                            checked={settings.show_header}
                            onChange={(v) => update('show_header', v)}
                        />
                    </PanelRow>

                    <PanelRow
                        title={__('Show page footer', 'fotogrids')}
                        description={__('Display the sharing controls and footer credit at the bottom of the view page.', 'fotogrids')}
                    >
                        <Toggle
                            checked={settings.show_footer}
                            onChange={(v) => update('show_footer', v)}
                        />
                    </PanelRow>
                </SettingsPanel>
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

export default ViewPagesTab;
