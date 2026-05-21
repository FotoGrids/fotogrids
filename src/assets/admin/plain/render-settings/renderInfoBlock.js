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
 *   "key": "...",          // optional — block is not saved
 *   "subtitle": "...",     // optional; bold label rendered above the message
 *   "message": "...",      // required; supports <strong> and <a> tags
 *   "icon": "info",        // optional; reserved for future icon rendering
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

    return h('div', {
        className: 'fotogrids-settings_info-block'
    }, [
        h('div', {
            key: 'content',
            className: 'fotogrids-settings_info-block__content'
        }, [
            subtitle
                ? h('strong', {
                    key: 'subtitle',
                    className: 'fotogrids-settings_info-block__subtitle'
                }, subtitle)
                : null,
            h('span', {
                key: 'message',
                className: 'fotogrids-settings_info-block__text',
                dangerouslySetInnerHTML: { __html: message }
            })
        ].filter(Boolean)),
        buttonLabel && buttonUrl
            ? h('button', {
                key: 'action',
                type: 'button',
                className: 'fotogrids-button fotogrids-button--primary fotogrids-button--small',
                onClick: handleButtonClick
            }, buttonLabel)
            : null
    ].filter(Boolean));
};
