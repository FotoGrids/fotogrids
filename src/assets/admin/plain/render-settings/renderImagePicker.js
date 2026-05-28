window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

/**
 * Image picker — stores an attachment ID, opens wp.media to choose, and
 * shows a thumbnail preview of the current selection.
 *
 * Setting shape:
 *   {
 *     "key":         "fotogrids_og_image_custom_id",
 *     "type":        "image_picker",
 *     "label":       "Custom OG Image",
 *     "description": "Recommended size: 1200×630px.",
 *     "default":     0,
 *     "buttonLabel": "Choose image"   // optional, defaults to "Choose image" / "Replace image"
 *   }
 *
 * The stored value is the attachment ID (integer) or 0 when nothing is
 * selected. We render the thumbnail via the WP REST media endpoint on
 * demand so the picker doesn't need a bootstrap payload.
 */
window.FotoGridsRenderSettings.renderImagePicker = (setting, currentValue, isDisabled, {
    updateSetting,
    getFieldState,
    __,
}) => {
    const { createElement: h, useState, useEffect, useRef } = wp.element;
    const settingState = typeof getFieldState === 'function'
        ? getFieldState(setting.key, currentValue)
        : 'editable';
    const showSettingBadge = settingState !== 'editable';
    const settingBadgeText = settingState === 'locked' ? __('Locked', 'fotogrids') : __('Pro', 'fotogrids');

    const ImagePicker = () => {
        const attachmentId = parseInt(currentValue, 10) || 0;
        const [previewUrl, setPreviewUrl] = useState(null);
        const [loading, setLoading] = useState(false);
        const mediaFrameRef = useRef(null);

        useEffect(() => {
            if (!attachmentId) {
                setPreviewUrl(null);
                return;
            }
            let active = true;
            setLoading(true);
            wp.apiFetch({ path: `/wp/v2/media/${attachmentId}` })
                .then((media) => {
                    if (!active) return;
                    const url = media?.media_details?.sizes?.medium?.source_url
                        || media?.media_details?.sizes?.thumbnail?.source_url
                        || media?.source_url
                        || null;
                    setPreviewUrl(url);
                })
                .catch(() => active && setPreviewUrl(null))
                .finally(() => active && setLoading(false));
            return () => { active = false; };
        }, [attachmentId]);

        const openPicker = () => {
            if (typeof wp === 'undefined' || typeof wp.media === 'undefined') {
                return;
            }
            if (!mediaFrameRef.current) {
                mediaFrameRef.current = wp.media({
                    title: setting.pickerTitle || __('Choose image', 'fotogrids'),
                    button: { text: setting.pickerButton || __('Use this image', 'fotogrids') },
                    multiple: false,
                    library: { type: 'image' },
                });
                mediaFrameRef.current.on('select', () => {
                    const sel = mediaFrameRef.current.state().get('selection').first();
                    if (sel) {
                        updateSetting(setting.key, sel.id);
                    }
                });
            }
            mediaFrameRef.current.open();
        };

        const clear = () => updateSetting(setting.key, 0);

        const chooseLabel = attachmentId
            ? __('Replace image', 'fotogrids')
            : (setting.buttonLabel || __('Choose image', 'fotogrids'));

        return h('div', { className: 'fotogrids-image-picker' }, [
            previewUrl && h('img', {
                key: 'preview',
                src: previewUrl,
                alt: '',
                className: 'fotogrids-image-picker__preview',
                style: { maxWidth: 200, maxHeight: 120, display: 'block', marginBottom: 8 },
            }),
            !previewUrl && attachmentId > 0 && loading && h('div', {
                key: 'loading',
                className: 'fotogrids-image-picker__loading',
                style: { marginBottom: 8, fontSize: 12, opacity: 0.7 },
            }, __('Loading preview…', 'fotogrids')),
            h('div', {
                key: 'actions',
                className: 'fotogrids-image-picker__actions',
                style: { display: 'flex', gap: 8, flexWrap: 'wrap' },
            }, [
                h('button', {
                    key: 'choose',
                    type: 'button',
                    className: 'fotogrids-button fotogrids-button--secondary fotogrids-button--small',
                    onClick: openPicker,
                    disabled: isDisabled,
                }, chooseLabel),
                attachmentId > 0 && h('button', {
                    key: 'clear',
                    type: 'button',
                    className: 'fotogrids-button fotogrids-button--ghost fotogrids-button--small',
                    onClick: clear,
                    disabled: isDisabled,
                }, __('Remove', 'fotogrids')),
            ].filter(Boolean)),
        ].filter(Boolean));
    };

    return h('div', { className: 'fotogrids-image-picker-wrapper' }, [
        setting.label && h('label', {
            key: 'label',
            className: 'fotogrids-setting__label',
        }, [
            setting.label,
            showSettingBadge && h('span', {
                key: 'badge',
                className: 'fotogrids-pro-badge',
            }, settingBadgeText),
        ].filter(Boolean)),
        h(ImagePicker, { key: 'picker' }),
        setting.description && h('div', {
            key: 'description',
            className: 'fotogrids-setting__description',
        }, setting.description),
    ].filter(Boolean));
};
