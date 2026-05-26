window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderSideBySide = (setting, currentValue, isDisabled, context) => {
    const { createElement: h } = wp.element;
    const { renderSetting } = context;

    if (!setting.settings || !Array.isArray(setting.settings)) {
        return null;
    }

    return h('div', {
        className: 'fotogrids-settings-sbs'
    }, setting.settings.map((subSetting) => {
        return renderSetting(subSetting, isDisabled);
    }));
};
