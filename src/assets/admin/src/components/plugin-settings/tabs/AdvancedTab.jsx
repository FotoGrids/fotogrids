import React, { useState, useEffect, useMemo } from 'react';
import apiFetch from '@wordpress/api-fetch';
import Toggle from '../../shared/Toggle';
import {
    SettingsPanel,
    PanelRow,
    DangerZone,
    SaveBar,
} from '../../shared/settings';

const { __ } = wp.i18n;

const DEFAULTS = {
    autosave: false,
    share_statistics: false,
    marketing_allowed: false,
    custom_js_allow_dynamic_execution: false,
    delete_data_on_uninstall: false,
};

/**
 * Plugin Settings → Advanced tab.
 *
 * Reads/writes the boolean advanced settings via
 * /fotogrids/v1/admin/advanced-settings. The uninstall toggle reads as
 * "delete on uninstall" but is persisted server-side as its inverse.
 */
const AdvancedTab = () => {
    const seed = window.fotogridsAdmin || {};
    const initial = {
        autosave: seed.autosave === true,
        share_statistics: seed.shareStatistics === true,
        marketing_allowed: seed.marketingAllowed === true,
        custom_js_allow_dynamic_execution: seed.customJsAllowDynamicExecution === true,
        delete_data_on_uninstall: DEFAULTS.delete_data_on_uninstall,
    };

    const [settings, setSettings] = useState(initial);
    const [saved, setSaved] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        let active = true;
        apiFetch({ path: '/fotogrids/v1/admin/advanced-settings' })
            .then((data) => {
                if (!active || !data?.settings) return;
                const s = {
                    autosave: data.settings.autosave === true,
                    share_statistics: data.settings.share_statistics === true,
                    marketing_allowed: data.settings.marketing_allowed === true,
                    custom_js_allow_dynamic_execution: data.settings.custom_js_allow_dynamic_execution === true,
                    delete_data_on_uninstall: data.settings.delete_data_on_uninstall === true,
                };
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
                path: '/fotogrids/v1/admin/advanced-settings',
                method: 'POST',
                data: settings,
            });
            const next = result?.settings
                ? {
                    autosave: result.settings.autosave === true,
                    share_statistics: result.settings.share_statistics === true,
                    marketing_allowed: result.settings.marketing_allowed === true,
                    custom_js_allow_dynamic_execution: result.settings.custom_js_allow_dynamic_execution === true,
                    delete_data_on_uninstall: result.settings.delete_data_on_uninstall === true,
                }
                : settings;
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

    return (
        <div className="fotogrids-sidebar-tabs__content__inner" key="advanced-content">
            <SettingsPanel
                title={__('Editor behaviour', 'fotogrids')}
                description={__('How FotoGrids saves your work in the gallery and album editors.', 'fotogrids')}
            >
                <PanelRow
                    title={__('Autosave', 'fotogrids')}
                    description={__('Saves gallery and album settings changes automatically as you work.', 'fotogrids')}
                >
                    <Toggle
                        id="fotogrids_autosave"
                        checked={settings.autosave}
                        onChange={(v) => update('autosave', v)}
                        label={__('Save automatically', 'fotogrids')}
                    />
                </PanelRow>
            </SettingsPanel>

            <SettingsPanel
                title={__('Privacy & analytics', 'fotogrids')}
                description={__('Decide what FotoGrids shares about plugin usage.', 'fotogrids')}
            >
                <PanelRow
                    title={__('Usage data', 'fotogrids')}
                    description={__('Helps us spot bugs and decide what to build next. Shares your name, email, site, and plugin details - never your images, image URLs, or visitor data.', 'fotogrids')}
                >
                    <Toggle
                        id="fotogrids_share_statistics"
                        checked={settings.share_statistics}
                        onChange={(v) =>
                            setSettings((prev) => {
                                setStatus(null);
                                return {
                                    ...prev,
                                    share_statistics: v,
                                    // Marketing consent can't outlive usage-data
                                    // sharing - clear it when sharing is turned off.
                                    marketing_allowed: v ? prev.marketing_allowed : false,
                                };
                            })
                        }
                        label={__('Share usage data', 'fotogrids')}
                    />
                </PanelRow>

                {settings.share_statistics && (
                    <PanelRow
                        title={__('Product emails', 'fotogrids')}
                        description={__('Occasional FotoGrids news and offers, sent to your account email. Separate from usage data - off unless enabled.', 'fotogrids')}
                    >
                        <Toggle
                            id="fotogrids_marketing_allowed"
                            checked={settings.marketing_allowed}
                            onChange={(v) => update('marketing_allowed', v)}
                            label={__('Email me FotoGrids news and offers', 'fotogrids')}
                        />
                    </PanelRow>
                )}
            </SettingsPanel>

            <SettingsPanel
                title={__('Custom code', 'fotogrids')}
                description={__('Controls for sites that use custom JavaScript in gallery fields.', 'fotogrids')}
            >
                <PanelRow
                    title={__('Dynamic JavaScript', 'fotogrids')}
                    description={__('Enables `eval`, the `Function` constructor and string-based `setTimeout` / `setInterval` in custom JS fields.', 'fotogrids')}
                >
                    <Toggle
                        id="fotogrids_custom_js_allow_dynamic"
                        checked={settings.custom_js_allow_dynamic_execution}
                        onChange={(v) => update('custom_js_allow_dynamic_execution', v)}
                        label={__('Allow dynamic code execution', 'fotogrids')}
                    />
                </PanelRow>
                <DangerZone
                    title={__('Applies to every role that can edit collections - administrators are never restricted.', 'fotogrids')}
                    description={__('Only turn this on if you trust everyone with editor access.', 'fotogrids')}
                />
            </SettingsPanel>

            <SettingsPanel
                title={__('Uninstall', 'fotogrids')}
                description={__('What happens to your FotoGrids data if the plugin is deleted.', 'fotogrids')}
            >
                <DangerZone
                    title={__('Delete all data on uninstall', 'fotogrids')}
                    description={__('Removes every gallery, album, template, statistic and setting. This cannot be undone.', 'fotogrids')}
                    icon="remove_item"
                >
                    <Toggle
                        id="fotogrids_delete_on_uninstall"
                        checked={settings.delete_data_on_uninstall}
                        onChange={(v) => update('delete_data_on_uninstall', v)}
                    />
                </DangerZone>
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

export default AdvancedTab;
