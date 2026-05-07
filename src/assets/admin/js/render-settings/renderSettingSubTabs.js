window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderSettingSubTabs = (setting, isDisabled, {
    activeSubTab,
    setActiveSubTab,
    renderIcon,
    renderSetting
}) => {
    if (!setting.subTabs) return null;

    const { createElement: h } = wp.element;

    // Get available sub-tabs
    const availableSubTabs = Object.values(setting.subTabs);

    // If only one sub-tab is available, render its content directly without wrapper
    if (availableSubTabs.length === 1) {
        const singleSubTab = availableSubTabs[0];
        return h('div', {
            className: 'fotogrids-lightbox-subtab-content fotogrids-lightbox-subtab-content--single'
        }, [
            h('div', {
                className: 'fotogrids-lightbox-subtab-content__inner'
            }, singleSubTab.settings?.map(subSetting => renderSetting(subSetting)) || [])
        ]);
    }

    return h('div', {
        className: 'fotogrids-lightbox-subtabs'
    }, [

        h('div', {
            className: 'fotogrids-lightbox-subtabs__nav'
        }, availableSubTabs.map(subTab =>
            h('button', {
                key: subTab.id,
                type: 'button',
                className: `fotogrids-lightbox-subtab ${activeSubTab === subTab.id ? 'fg-is-active' : ''}`,
                onClick: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveSubTab(subTab.id);
                },
                disabled: isDisabled
            }, [
                h('span', {
                    className: 'fotogrids-lightbox-subtab__icon'
                }, renderIcon(subTab.icon)),
                h('span', {
                    className: 'fotogrids-lightbox-subtab__label'
                }, subTab.label)
            ])
        )),


        h('div', {
            className: 'fotogrids-lightbox-subtab-content'
        }, [
            h('div', {
                className: 'fotogrids-lightbox-subtab-content__inner'
            }, setting.subTabs[activeSubTab]?.settings.map(subSetting => renderSetting(subSetting)) || [])
        ])
    ]);
};
