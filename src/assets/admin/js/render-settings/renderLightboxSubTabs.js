window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderLightboxSubTabs = (setting, isDisabled, {
    activeSubTab,
    setActiveSubTab,
    renderIcon,
    renderSetting
}) => {
    if (!setting.subTabs) return null;
    
    const { createElement: h } = wp.element;
    
    return h('div', {
        className: 'fotogrids-lightbox-subtabs'
    }, [

        h('div', {
            className: 'fotogrids-lightbox-subtabs__nav'
        }, Object.values(setting.subTabs).map(subTab => 
            h('button', {
                key: subTab.id,
                type: 'button',
                className: `fotogrids-lightbox-subtab ${activeSubTab === subTab.id ? 'is-active' : ''}`,
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
