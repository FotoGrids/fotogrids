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

const DEFAULTS = {
    accent_color: '#3c46f0',
    theme: 'light',
    max_width: 1200,
    show_header: true,
};

const normalize = (raw) => ({ ...DEFAULTS, ...(raw || {}) });

/**
 * Plugin Settings → View Pages tab.
 *
 * Reads/writes the global fotogrids_view_settings option via
 * /fotogrids/v1/admin/view-settings. Styles every gallery and album view page.
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

    const settingsUrl = window.fotogridsAdmin?.settingsBaseUrl || '';

    return (
        <div className="fotogrids-sidebar-tabs__content__inner" key="view-pages-content">
            <SettingsPanel
                title={__('View Pages', 'fotogrids')}
                description={__('Control how the standalone view pages for your Galleries and Albums look and behave. These settings apply to every view page.', 'fotogrids')}
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
                        onChange={(v) => update('max_width', Math.max(320, Math.min(3000, v)))}
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
            </SettingsPanel>

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
