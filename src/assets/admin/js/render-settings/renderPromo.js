window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderPromo = (setting, currentValue, isDisabled, {
    isProActive,
    __
}) => {
    const { createElement: h } = wp.element;

    const handleUpgradeClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const upgradeUrl = window.fotogridsUpgradeModal?.urls?.upgrade;
        if (upgradeUrl) {
            window.open(upgradeUrl, '_blank');
        }
    };

    const messages = setting.messages || [];

    if (messages.length === 0 && (setting.message || setting.description)) {
        messages.push({
            subtitle: '',
            message: setting.message || setting.description
        });
    }

    const handleLearnMoreClick = (learnMorePath) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(`https://go.fotogrids.com/${learnMorePath}`, '_blank');
    };

    return h('div', {
        className: 'fotogrids-settings-pro-message'
    }, [
        h('span', {
            className: 'fotogrids-pro-badge'
        }, __('PRO', 'fotogrids')),
        h('div', {
            className: 'fotogrids-settings-pro-message__content'
        }, messages.map((message, index) => {
            const messageText = message.message || '';
            const hasLearnMore = !!message.learn_more;

            return h('div', {
                key: index,
                className: 'fotogrids-settings-pro-message__item'
            }, [
                message.subtitle && h('strong', {
                    className: 'fotogrids-settings-pro-message__subtitle'
                }, message.subtitle),
                h('span', {
                    className: 'fotogrids-settings-pro-message__text',
                    dangerouslySetInnerHTML: {
                        __html: messageText + (hasLearnMore ? ` <a href="https://go.fotogrids.com/${message.learn_more}" target="_blank" rel="noopener noreferrer" class="fotogrids-settings-pro-message__learn-more">${__('Learn more', 'fotogrids')}</a>` : '')
                    }
                })
            ].filter(Boolean));
        })),
        h('button', {
            type: 'button',
            className: 'fotogrids-button fotogrids-button--primary fotogrids-button--small',
            onClick: handleUpgradeClick
        }, __('Upgrade Now', 'fotogrids'))
    ]);
};
