window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderBulkModal = ({
    showBulkModal,
    bulkAction,
    bulkUrl,
    setBulkUrl,
    bulkTarget,
    setBulkTarget,
    validateUrl,
    closeBulkModal,
    executeBulkAction,
    __
}) => {
    if (!showBulkModal) return null;
    
    const { createElement: h } = wp.element;
    
    const validation = validateUrl(bulkUrl);
    const canExecute = bulkAction === 'clear_all' || (bulkAction === 'apply_to_all' && validation.valid && bulkUrl.trim());
    
    return h('div', {
        className: 'fotogrids-modal',
        id: 'fotogrids-modal__bulk-external-url',
    }, [
        h('div', {
            className: 'fotogrids-modal__overlay',
            onClick: (e) => {
                if (e.target === e.currentTarget) {
                    closeBulkModal();
                }
            }
        }),

        h('div', {
            className: 'fotogrids-modal__content'
        }, [
            h('div', {
                className: 'fotogrids-modal__header'
            }, [
                h('h3', {}, bulkAction === 'apply_to_all' ? __('Apply URL to All Items', 'fotogrids') : __('Clear All URLs', 'fotogrids')),
                h('button', {
                    type: 'button',
                    className: 'fotogrids-modal__close',
                    onClick: closeBulkModal
                }, '×')
            ]),
            
            h('div', {
                className: 'fotogrids-modal__body'
            }, [
                h('div', {
                    className: 'fotogrids-modal__layout fotogrids-modal__layout-single'
                }, [
                    bulkAction === 'apply_to_all' ? [
                        h('div', {
                            className: 'fotogrids-modal__field'
                        }, [
                            h('label', {
                                className: 'fotogrids-setting__label'
                            }, __('URL to apply to all items', 'fotogrids')),
                            h('input', {
                                type: 'url',
                                value: bulkUrl,
                                placeholder: __('Enter URL (e.g., https://example.com)', 'fotogrids'),
                                className: `fotogrids-modal__input ${!validation.valid ? 'fotogrids-modal__input--invalid' : validation.valid && bulkUrl ? 'fotogrids-modal__input--valid' : ''}`,
                                onChange: (e) => setBulkUrl(e.target.value),
                                onKeyDown: (e) => {
                                    if (e.key === 'Enter' && canExecute) {
                                        executeBulkAction();
                                    }
                                }
                            }),
                            validation.message && h('div', {
                                className: `fotogrids-modal__validation ${validation.valid ? 'fotogrids-modal__validation--valid' : 'fotogrids-modal__validation--invalid'}`
                            }, validation.message)
                        ]),
                        
                        h('div', {
                            className: 'fotogrids-modal__field'
                        }, [
                            h('label', {
                                className: 'fotogrids-setting__label'
                            }, __('Link Target', 'fotogrids')),
                            h('select', {
                                value: bulkTarget,
                                onChange: (e) => setBulkTarget(e.target.value),
                                className: 'fotogrids-modal__select'
                            }, [
                                h('option', { value: 'global' }, __('Global Default', 'fotogrids')),
                                h('option', { value: '_self' }, __('Same Tab', 'fotogrids')),
                                h('option', { value: '_blank' }, __('New Tab', 'fotogrids'))
                            ])
                        ])
                    ] : [
                        h('p', {}, __('Are you sure you want to clear all URLs? This action cannot be undone.', 'fotogrids'))
                    ]
                ])
            ]),
            
            h('div', {
                className: 'fotogrids-modal__footer'
            }, [
                h('button', {
                    type: 'button',
                    className: 'fg-button fg-button--variant-secondary',
                    onClick: closeBulkModal
                }, __('Cancel', 'fotogrids')),
                h('button', {
                    type: 'button',
                    className: `fg-button fg-button--variant-primary`,
                    onClick: executeBulkAction,
                    disabled: !canExecute
                }, bulkAction === 'apply_to_all' ? __('Apply to All', 'fotogrids') : __('Clear All', 'fotogrids'))
            ])
        ])
    ]);
};
