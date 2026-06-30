import React, { useState, useEffect, useMemo, useRef } from 'react';
import apiFetch from '@wordpress/api-fetch';
import {
    SettingsPanel,
    PanelRow,
    Segmented,
    NumberField,
    SaveBar,
} from '../../shared/settings';
import Toggle from '../../shared/Toggle';
import Select from '../../shared/Select';
import AlignmentGrid from '../../shared/AlignmentGrid';
import ProBadge from '../../ProBadge';
import InfoBlock from '../../shared/InfoBlock';
import WatermarkRegenerate from '../watermark/WatermarkRegenerate';
import { Button } from '../../shared/Button';

const { __ } = wp.i18n;

/**
 * A PanelRow title that carries a Pro lock badge. Used for controls that are
 * configured site-wide but only take effect on a paid plan.
 */
const TeaserTitle = ({ children, tier = 'pro_starter' }) => (
    <span className="fotogrids-setting__teaser-title">
        {children}
        <ProBadge tier={tier} />
    </span>
);

// cssFamily mirrors Watermark_Settings_Store::FONTS family names (the
// @font-face families enqueued on the settings page), with a generic
// fallback so previews degrade gracefully before the TTFs are bundled.
const FONTS = [
    { value: 'inter', label: 'Inter', cssFamily: "'FG Inter', sans-serif" },
    { value: 'roboto', label: 'Roboto', cssFamily: "'FG Roboto', sans-serif" },
    { value: 'open-sans', label: 'Open Sans', cssFamily: "'FG Open Sans', sans-serif" },
    { value: 'montserrat', label: 'Montserrat', cssFamily: "'FG Montserrat', sans-serif" },
    { value: 'oswald', label: 'Oswald', cssFamily: "'FG Oswald', sans-serif" },
    { value: 'lora', label: 'Lora', cssFamily: "'FG Lora', serif" },
    { value: 'playfair-display', label: 'Playfair Display', cssFamily: "'FG Playfair Display', serif" },
    { value: 'merriweather', label: 'Merriweather', cssFamily: "'FG Merriweather', serif" },
    { value: 'jetbrains-mono', label: 'JetBrains Mono', cssFamily: "'FG JetBrains Mono', monospace" },
    { value: 'dancing-script', label: 'Dancing Script', cssFamily: "'FG Dancing Script', cursive" },
];

const fontOptionStyle = (option) => (
    option.cssFamily ? { fontFamily: option.cssFamily } : undefined
);

const DEFAULTS = {
    enable_watermark: false,
    watermark_type: 'text',
    watermark_image_url: '',
    watermark_image_size: 20,
    watermark_text: '© Your Name',
    watermark_font_family: 'inter',
    watermark_font_size: 'regular',
    watermark_text_color: 'light',
    watermark_custom_text_color: '#ffffff',
    watermark_position: 'bottom-right',
    watermark_opacity: 70,
    watermark_margin: 20,
    watermark_apply_to: 'full',
    watermark_repeat: false,
    watermark_repeat_spacing: 200,
};

const normalize = (raw) => ({ ...DEFAULTS, ...(raw || {}) });

/**
 * Plugin Settings → Watermark tab.
 *
 * Reads/writes the global fotogrids_watermark_settings option via
 * /fotogrids/v1/admin/watermark-settings. The watermark is configured here
 * site-wide; per-collection overrides layer on top elsewhere. This tab
 * configures the text watermark; image watermarks and advanced placement are
 * Pro features.
 */
const WatermarkTab = () => {
    const initial = normalize(window.fotogridsAdmin?.watermarkSettings);

    const [settings, setSettings] = useState(initial);
    const [saved, setSaved] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);
    const [justEnabled, setJustEnabled] = useState(false);
    // Bumped after each successful save so the regenerate banner re-checks
    // status (a config change can mark every image stale).
    const [regenRefresh, setRegenRefresh] = useState(0);

    // Tracks the last persisted enable state so a save that flips it on can
    // surface the one-time "existing images aren't done yet" prompt.
    const wasEnabledRef = useRef(initial.enable_watermark);

    useEffect(() => {
        let active = true;
        apiFetch({ path: '/fotogrids/v1/admin/watermark-settings' })
            .then((data) => {
                if (!active || !data?.settings) return;
                const s = normalize(data.settings);
                setSettings(s);
                setSaved(s);
                wasEnabledRef.current = s.enable_watermark;
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
                path: '/fotogrids/v1/admin/watermark-settings',
                method: 'POST',
                data: settings,
            });
            const next = result?.settings ? normalize(result.settings) : settings;
            // Detect an off → on transition to surface the one-time prompt.
            if (next.enable_watermark && !wasEnabledRef.current) {
                setJustEnabled(true);
            }
            wasEnabledRef.current = next.enable_watermark;
            setSettings(next);
            setSaved(next);
            setStatus('saved');
            setRegenRefresh((n) => n + 1);
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

    const enabled = settings.enable_watermark;

    return (
        <div className="fotogrids-sidebar-tabs__content__inner" key="watermark-content">
            <SettingsPanel
                title={__('Watermark', 'fotogrids')}
                description={__('Add a visible credit mark to the images shown in your galleries. Your original files stay untouched - FotoGrids applies the watermark only to the generated copies served on your site.', 'fotogrids')}
            >
                <PanelRow
                    title={__('Enable watermark', 'fotogrids')}
                    description={__('Add your credit to gallery images.', 'fotogrids')}
                >
                    <Toggle
                        checked={enabled}
                        onChange={(v) => update('enable_watermark', v)}
                    />
                </PanelRow>
            </SettingsPanel>

            {enabled && justEnabled && (
                <InfoBlock
                    icon="info_square"
                    title={__('Watermarking is enabled - existing images still need updating', 'fotogrids')}
                    description={__('New uploads will be watermarked automatically. Images already used in your galleries need to be regenerated once before the watermark appears on them.', 'fotogrids')}                >
                    <Button
                        variant="link"
                        size="sm"
                        onClick={() => setJustEnabled(false)}
                    >
                        {__('Dismiss', 'fotogrids')}
                    </Button>
                </InfoBlock>
            )}

            {enabled && <WatermarkRegenerate refreshKey={regenRefresh} />}

            {enabled && (
                <>
                    <SettingsPanel
                        title={__('Type', 'fotogrids')}
                        titleTag="h3"
                        description={__('Use a text watermark now, or upgrade to add your own logo.', 'fotogrids')}                    >
                        <PanelRow
                            title={<TeaserTitle>{__('Watermark type', 'fotogrids')}</TeaserTitle>}
                            description={__('Use your own logo as a watermark with Pro.', 'fotogrids')}
                        >
                            <Segmented
                                ariaLabel={__('Watermark type', 'fotogrids')}
                                value="text"
                                onChange={() => {}}
                                disabled
                                options={[
                                    { value: 'text', label: __('Text', 'fotogrids') },
                                    { value: 'image', label: __('Image', 'fotogrids') },
                                ]}
                            />
                        </PanelRow>
                    </SettingsPanel>

                    <SettingsPanel
                        title={__('Text', 'fotogrids')}
                        titleTag="h3"
                        description={__('Add your name, studio name, website, or copyright notice to each image.', 'fotogrids')}
                    >
                        <PanelRow
                            title={__('Watermark text', 'fotogrids')}
                            htmlFor="fg-watermark-text"
                        >
                            <input
                                id="fg-watermark-text"
                                type="text"
                                className="fotogrids-text-input"
                                value={settings.watermark_text}
                                placeholder={__('© Your Name', 'fotogrids')}
                                onChange={(e) => update('watermark_text', e.target.value)}
                            />
                        </PanelRow>
                        <PanelRow title={__('Font family', 'fotogrids')}>
                            <Select
                                value={settings.watermark_font_family}
                                onChange={(v) => update('watermark_font_family', v)}
                                options={FONTS}
                                optionStyle={fontOptionStyle}
                                width={200}
                            />
                        </PanelRow>
                        <PanelRow
                            title={__('Font size', 'fotogrids')}
                            description={__('Scales with each photo, so it reads the same on a thumbnail and a full-size image download.', 'fotogrids')}
                        >
                            <Segmented
                                ariaLabel={__('Font size', 'fotogrids')}
                                value={settings.watermark_font_size}
                                onChange={(v) => update('watermark_font_size', v)}
                                options={[
                                    { value: 'small', label: __('Small', 'fotogrids') },
                                    { value: 'regular', label: __('Regular', 'fotogrids') },
                                    { value: 'large', label: __('Large', 'fotogrids') },
                                ]}
                            />
                        </PanelRow>
                        <PanelRow title={__('Text colour', 'fotogrids')}>
                            <Segmented
                                ariaLabel={__('Text colour', 'fotogrids')}
                                value={settings.watermark_text_color}
                                onChange={(v) => update('watermark_text_color', v)}
                                options={[
                                    { value: 'light', label: __('Light', 'fotogrids') },
                                    { value: 'dark', label: __('Dark', 'fotogrids') },
                                ]}
                            />
                        </PanelRow>
                        <PanelRow
                            title={<TeaserTitle>{__('Custom color', 'fotogrids')}</TeaserTitle>}
                            description={__('Match the watermark to your brand or any custom color.', 'fotogrids')}
                        >
                            <input
                                type="text"
                                className="fotogrids-text-input"
                                value={settings.watermark_custom_text_color}
                                disabled
                                aria-label={__('Custom color', 'fotogrids')}
                            />
                        </PanelRow>
                    </SettingsPanel>

                    <SettingsPanel
                        title={__('Position & styling', 'fotogrids')}
                        titleTag="h3"
                        description={__('Choose where the watermark appears and how visible it should be.', 'fotogrids')}
                    >
                        <PanelRow
                            title={__('Position', 'fotogrids')}
                        >
                            <AlignmentGrid
                                ariaLabel={__('Watermark position', 'fotogrids')}
                                value={settings.watermark_position}
                                onChange={(v) => update('watermark_position', v)}
                            />
                        </PanelRow>
                        <PanelRow title={__('Opacity', 'fotogrids')}>
                            <NumberField
                                value={settings.watermark_opacity}
                                onChange={(v) => update('watermark_opacity', v)}
                                min={10}
                                max={100}
                                unit="%"
                            />
                        </PanelRow>
                        <PanelRow
                            title={__('Margin', 'fotogrids')}
                            description={__('Set the distance between the watermark and the image edge.', 'fotogrids')}
                        >
                            <NumberField
                                value={settings.watermark_margin}
                                onChange={(v) => update('watermark_margin', v)}
                                min={0}
                                max={100}
                                unit="px"
                            />
                        </PanelRow>
                    </SettingsPanel>

                    <SettingsPanel
                        title={__('Advanced', 'fotogrids')}
                        titleTag="h3"
                        description={__('Unlock even more control over which image versions are watermarked and how the mark is applied.', 'fotogrids')}
                    >
                        <PanelRow
                            title={<TeaserTitle>{__('Apply to', 'fotogrids')}</TeaserTitle>}
                            description={__('Choose whether to watermark full images, thumbnails, or both with Pro.', 'fotogrids')}
                        >
                            <Segmented
                                ariaLabel={__('Apply watermark to', 'fotogrids')}
                                value="full"
                                onChange={() => {}}
                                disabled
                                options={[
                                    { value: 'full', label: __('Full images', 'fotogrids') },
                                    { value: 'thumbnails', label: __('Thumbnails', 'fotogrids') },
                                    { value: 'both', label: __('Both', 'fotogrids') },
                                ]}
                            />
                        </PanelRow>
                        <PanelRow
                            title={<TeaserTitle>{__('Repeat watermark', 'fotogrids')}</TeaserTitle>}
                            description={__('Repeat the watermark across the image to make it harder to crop out, with Pro.', 'fotogrids')}
                        >
                            <Toggle checked={false} onChange={() => {}} disabled />
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

export default WatermarkTab;
