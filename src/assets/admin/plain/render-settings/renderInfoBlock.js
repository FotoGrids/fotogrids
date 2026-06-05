window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

/**
 * Renders an informational block inside a settings panel.
 *
 * Similar in structure to renderPromo but stripped of all upsell elements
 * (no Pro badge, no Upgrade button). Use when you need to surface a notice,
 * tip, or link to a related tool inside a settings tab.
 *
 * JSON schema for the `setting` object:
 * {
 *   "type": "info_block",
 *   "key": "...",          // optional - block is not saved
 *   "subtitle": "...",     // optional; bold label rendered above the message
 *   "message": "...",      // required; supports <strong> and <a> tags
 *   "icon": "info_square", // optional; renders a fotogrids-icon before the inner block; defaults to "info_square"
 *   "full_width": false,   // optional; when true, removes content max-width limit
 *   "button_label": "...", // optional; shows a secondary action button
 *   "button_url": "..."    // required when button_label is set
 * }
 */
window.FotoGridsRenderSettings.renderInfoBlock = (setting, currentValue, isDisabled, {
    __
}) => {
    const { createElement: h } = wp.element;

    const subtitle = setting.subtitle || null;
    const message = setting.message || setting.description || '';
    const buttonLabel = setting.button_label || null;

    // button_url: direct URL string.
    // button_url_key: a key on window.fotogridsSettings (for dynamic admin URLs).
    const buttonUrl = setting.button_url
        || ( setting.button_url_key && window.fotogridsSettings?.[setting.button_url_key] )
        || null;

    const handleButtonClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (buttonUrl) {
            window.open(buttonUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const icon = setting.icon !== undefined ? setting.icon : 'info_square';
    const iconSvg = icon ? ( window.FotoGridsIcons?.[icon] || null ) : null;

    const baseClass = 'fotogrids-settings_info-block';
    const isFullWidth = Boolean(setting.full_width);
    const rootClassName = [
        baseClass,
        isFullWidth ? `${baseClass}--full-width` : null,
    ].filter(Boolean).join(' ');

    return h('div', {
        className: rootClassName,
    }, [
        icon
            ? h('span', {
                key: 'icon',
                className: `${baseClass}__icon fotogrids-icon fotogrids-icon--${icon}`,
                ...(iconSvg ? { dangerouslySetInnerHTML: { __html: iconSvg } } : {})
            }, iconSvg ? undefined : icon)
            : null,
        h('div', {
            key: 'inner',
            className: `${baseClass}__inner`
        }, [
            h('div', {
                key: 'content',
                className: `${baseClass}__content`
            }, [
                subtitle
                    ? h('strong', {
                        key: 'subtitle',
                        className: `${baseClass}__subtitle`
                    }, subtitle)
                    : null,
                h('span', {
                    key: 'message',
                    className: `${baseClass}__text`,
                    dangerouslySetInnerHTML: { __html: message }
                })
            ].filter(Boolean)),
            buttonLabel && buttonUrl
                ? h('button', {
                    key: 'action',
                    type: 'button',
                    className: 'fg-button fg-button--variant-primary fg-button--size-sm',
                    onClick: handleButtonClick
                }, buttonLabel)
                : null
        ].filter(Boolean))
    ].filter(Boolean));
};
