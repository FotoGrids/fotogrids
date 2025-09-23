window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderResponsiveRange = (setting, currentValue, isDisabled, { 
    updateSetting, 
    activeDevice, 
    setActiveDevice, 
    renderIcon,
    __
}) => {
    const defaults = window.fotogridsSettings?.defaults || {};
    const defaultResponsive = defaults[setting.key] || setting.responsive;
    
    const responsiveValue = currentValue && typeof currentValue === 'object' 
        ? currentValue 
        : {
            desktop: defaultResponsive.desktop || setting.responsive.desktop.default,
            tablet: defaultResponsive.tablet || setting.responsive.tablet.default,
            mobile: defaultResponsive.mobile || setting.responsive.mobile.default
        };
    
    const updateResponsiveValue = (device, value) => {
        const newValue = {
            ...responsiveValue,
            [device]: value
        };
        updateSetting(setting.key, newValue);
    };
    
    const devices = [
        { key: 'desktop', label: __('Desktop', 'fotogrids'), icon: 'responsive_desktop' },
        { key: 'tablet', label: __('Tablet', 'fotogrids'), icon: 'responsive_tablet' },
        { key: 'mobile', label: __('Mobile', 'fotogrids'), icon: 'responsive_mobile' }
    ];
    
    const activeDeviceData = devices.find(d => d.key === activeDevice);
    const currentDeviceValue = responsiveValue[activeDevice] || setting.responsive[activeDevice].default;
    
    const { createElement: h } = wp.element;
    
    return h('div', {
        className: 'fotogrids-responsive-setting'
    }, [

        h('div', {
            className: 'fotogrids-responsive-setting__header'
        }, [
            h('label', {
                className: 'fotogrids-responsive-setting__label'
            }, setting.label),
            h('span', {
                className: 'fotogrids-responsive-setting__device-icon'
            }, renderIcon(activeDeviceData.icon))
        ]),
        

        h('div', {
            className: 'fotogrids-responsive-setting__controls'
        }, [

            h('div', {
                className: 'fotogrids-responsive-setting__range'
            }, [
                h('input', {
                    type: 'range',
                    min: setting.responsive[activeDevice].min,
                    max: setting.responsive[activeDevice].max,
                    value: currentDeviceValue,
                    onChange: (e) => updateResponsiveValue(activeDevice, parseInt(e.target.value)),
                    disabled: isDisabled,
                    className: 'fotogrids-range-slider'
                })
            ]),
            

            h('div', {
                className: 'fotogrids-responsive-setting__input'
            }, [
                h('input', {
                    type: 'number',
                    min: setting.responsive[activeDevice].min,
                    max: setting.responsive[activeDevice].max,
                    value: currentDeviceValue,
                    onChange: (e) => updateResponsiveValue(activeDevice, parseInt(e.target.value) || setting.responsive[activeDevice].default),
                    disabled: isDisabled,
                    className: 'fotogrids-responsive-number-input'
                })
            ]),
            

            h('div', {
                className: 'fotogrids-responsive-setting__devices'
            }, devices.map(device => 
                h('button', {
                    key: device.key,
                    type: 'button',
                    className: `fotogrids-responsive-device-btn ${activeDevice === device.key ? 'is-active' : ''}`,
                    onClick: (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveDevice(device.key);
                    },
                    disabled: isDisabled,
                    title: device.label
                }, renderIcon(device.icon))
            ))
        ])
    ]);
};
