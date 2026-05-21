import React, { useState, useEffect, useMemo } from 'react';
import apiFetch from '@wordpress/api-fetch';
import {
    SettingsPanel,
    SettingRow,
    NumberField,
    Segmented,
    BreakpointPreview,
    SaveBar,
} from '../../shared/settings';

const { __ } = wp.i18n;

const DEFAULTS = {
    mobile_breakpoint: 767,
    tablet_breakpoint: 1024,
    detect_responsive_by_browser: false,
};

/**
 * Plugin Settings → Responsiveness tab.
 *
 * Reads/writes the canonical fotogrids_general_settings keys
 * (mobile_breakpoint / tablet_breakpoint / detect_responsive_by_browser) via
 * /fotogrids/v1/admin/general-settings — the same option the public frontend
 * renderer consumes.
 */
const ResponsivenessTab = () => {
    const seed = window.fotogridsAdmin?.generalSettings || {};
    const initial = {
        mobile_breakpoint: Number.isFinite(Number(seed.mobile_breakpoint)) ? Number(seed.mobile_breakpoint) : DEFAULTS.mobile_breakpoint,
        tablet_breakpoint: Number.isFinite(Number(seed.tablet_breakpoint)) ? Number(seed.tablet_breakpoint) : DEFAULTS.tablet_breakpoint,
        detect_responsive_by_browser: seed.detect_responsive_by_browser === true,
    };

    const [settings, setSettings] = useState(initial);
    const [saved, setSaved] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);

    // Refresh from the canonical REST source on mount so we never rely solely
    // on the localized seed.
    useEffect(() => {
        let active = true;
        apiFetch({ path: '/fotogrids/v1/admin/general-settings' })
            .then((data) => {
                if (!active || !data?.settings) return;
                const s = {
                    mobile_breakpoint: Number(data.settings.mobile_breakpoint),
                    tablet_breakpoint: Number(data.settings.tablet_breakpoint),
                    detect_responsive_by_browser: data.settings.detect_responsive_by_browser === true,
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
                path: '/fotogrids/v1/admin/general-settings',
                method: 'POST',
                data: settings,
            });
            const next = result?.settings
                ? {
                    mobile_breakpoint: Number(result.settings.mobile_breakpoint),
                    tablet_breakpoint: Number(result.settings.tablet_breakpoint),
                    detect_responsive_by_browser: result.settings.detect_responsive_by_browser === true,
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
        <div key="responsiveness-content">
            <SettingsPanel
                title={__('Breakpoints', 'fotogrids')}
                description={__('Pixel widths where FotoGrids switches between mobile, tablet and desktop layouts.', 'fotogrids')}
            >
                <SettingRow
                    title={__('Mobile', 'fotogrids')}
                    description={__('Below this width, mobile layout rules apply.', 'fotogrids')}
                    htmlFor="fg-bp-mobile"
                >
                    <NumberField
                        id="fg-bp-mobile"
                        value={settings.mobile_breakpoint}
                        onChange={(v) => update('mobile_breakpoint', Math.max(0, v))}
                        unit="px"
                        min={0}
                    />
                </SettingRow>

                <SettingRow
                    title={__('Tablet', 'fotogrids')}
                    description={__('Below this width and above the mobile breakpoint, tablet rules apply.', 'fotogrids')}
                    htmlFor="fg-bp-tablet"
                >
                    <NumberField
                        id="fg-bp-tablet"
                        value={settings.tablet_breakpoint}
                        onChange={(v) => update('tablet_breakpoint', Math.max(0, v))}
                        unit="px"
                        min={0}
                    />
                </SettingRow>

                <SettingRow
                    title={__('Preview', 'fotogrids')}
                    description={__('Three device sizes mapped to your current breakpoints.', 'fotogrids')}
                >
                    <BreakpointPreview
                        mobile={settings.mobile_breakpoint}
                        tablet={settings.tablet_breakpoint}
                    />
                </SettingRow>
            </SettingsPanel>

            <SettingsPanel
                title={__('Detection mode', 'fotogrids')}
                description={__('How FotoGrids decides which layout to serve.', 'fotogrids')}
            >
                <SettingRow
                    title={__('Detect by', 'fotogrids')}
                    description={__('Viewport width is the most predictable. Device capabilities is heuristic-based and can differ across browsers.', 'fotogrids')}
                >
                    <Segmented
                        ariaLabel={__('Detection mode', 'fotogrids')}
                        value={settings.detect_responsive_by_browser ? 'device' : 'viewport'}
                        onChange={(v) => update('detect_responsive_by_browser', v === 'device')}
                        options={[
                            { value: 'viewport', label: __('Viewport width', 'fotogrids'), icon: 'columns_02' },
                            { value: 'device', label: __('Device & browser', 'fotogrids'), icon: 'responsive_mobile' },
                        ]}
                    />
                </SettingRow>
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

export default ResponsivenessTab;
