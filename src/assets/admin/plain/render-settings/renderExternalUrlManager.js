window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderExternalUrlManager = (setting, isDisabled, {
    settings,
    canEditPosts,
    loadingItems,
    itemError,
    loadItemData,
    galleryItems,
    itemData,
    savingItems,
    openBulkModal,
    updateItemUrl,
    validateUrl,
    renderIcon,
    updateSetting,
    __
}) => {
    const { createElement: h } = wp.element;

    const globalTarget = settings.external_link_target || '_self';


    if (!canEditPosts) {
        return h('div', {
            className: 'fotogrids-external-url-manager fotogrids-external-url-manager--no-permission'
        }, [
            h('div', {
                className: 'fotogrids-permission-notice'
            }, [
                h('p', {}, __('You do not have permission to edit item URLs. The "edit_posts" capability is required.', 'fotogrids'))
            ])
        ]);
    }


    if (loadingItems) {
        return h('div', {
            className: 'fotogrids-external-url-manager fotogrids-external-url-manager--loading'
        }, [
            h('div', {
                className: 'fotogrids-bulk-actions'
            }, [
                h('div', {
                    className: 'fotogrids-bulk-actions__skeleton'
                })
            ]),
            h('div', {
                className: 'fotogrids-item-url-grid'
            }, galleryItems.map(itemId =>
                h('div', {
                    key: itemId,
                    className: 'fotogrids-item-url-item fotogrids-item-url-item--skeleton'
                }, [
                    h('div', {
                        className: 'fotogrids-item-url-item__thumbnail'
                    }),
                    h('div', {
                        className: 'fotogrids-item-url-item__fields'
                    }, [
                        h('div', {
                            className: 'fotogrids-item-url-item__url-field'
                        }),
                        h('div', {
                            className: 'fotogrids-item-url-item__target-field'
                        })
                    ])
                ])
            ))
        ]);
    }


    if (itemError) {
        return h('div', {
            className: 'fotogrids-external-url-manager fotogrids-external-url-manager--error'
        }, [
            h('div', {
                className: 'fotogrids-error-notice'
            }, [
                h('p', {}, itemError),
                h('button', {
                    type: 'button',
                    onClick: loadItemData,
                    className: 'button'
                }, __('Retry', 'fotogrids'))
            ])
        ]);
    }

    return h('div', {
        className: 'fotogrids-external-url-manager'
    }, [

        h('div', {
            className: 'fotogrids-bulk-actions'
        }, [
            h('div', {
                className: 'fotogrids-bulk-actions__defaults'
            }, [
                h('div', {
                    className: 'fg-button-group'
                }, [
                    h('label', {
                        className: 'fotogrids-setting__label'
                    }, __('Default Link Target', 'fotogrids')),
                    h('div', {
                        className: 'fg-button-group__buttons'
                    }, [
                        { label: __('Same Tab', 'fotogrids'), value: '_self', icon: 'check_square' },
                        { label: __('New Tab', 'fotogrids'), value: '_blank', icon: 'plus_square' }
                    ].map(option =>
                        h('button', {
                            key: option.value,
                            type: 'button',
                            className: `fg-button-group__button ${globalTarget === option.value ? 'fg-is-active' : ''}`,
                            onClick: () => !isDisabled && updateSetting('external_link_target', option.value),
                            disabled: isDisabled,
                            title: option.label || ''
                        }, [
                            option.icon && h('span', {
                                className: 'fg-button-icon'
                            }, renderIcon(option.icon)),
                            option.label && h('span', {
                                className: 'fg-button-label'
                            }, option.label)
                        ])
                    ))
                ])
            ]),
            h('div', {
                className: 'fotogrids-bulk-actions__bulk-actions'
            }, [
                h('label', {
                    className: 'fotogrids-setting__label'
                }, __('Bulk Actions', 'fotogrids')),
                h('div', {
                    className: 'fg-button-group__buttons'
                }, [
                    h('button', {
                        type: 'button',
                        className: 'fg-button fg-button--variant-secondary',
                        onClick: () => openBulkModal('apply_to_all')
                    }, __('Apply URL to All', 'fotogrids')),
                    h('button', {
                        type: 'button',
                        className: 'fg-button fg-button--variant-secondary',
                        onClick: () => openBulkModal('clear_all')

                    }, __('Clear All URLs', 'fotogrids'))
                ])
            ])
        ]),


        h('div', {
            className: 'fotogrids-item-url-grid'
        }, galleryItems.map(itemId => {
            const data = itemData[itemId] || {};
            const currentUrl = data.url || '';
            const currentTarget = data.target || 'global';
            const isSaving = savingItems[itemId];

            return h('div', {
                key: itemId,
                className: 'fotogrids-item-url-item'
            }, [

                h('div', {
                    className: 'fotogrids-item-url-item__thumbnail'
                }, [
                    data.thumbnail ? h('img', {
                        src: data.thumbnail,
                        alt: data.alt || data.title || '',
                        loading: 'lazy'
                    }) : h('div', {
                        className: 'fotogrids-item-url-item__thumbnail-placeholder'
                    }, h('svg', {
                        width: '100%',
                        height: '100%',
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        xmlns: 'http://www.w3.org/2000/svg'
                    }, h('path', {
                        d: 'M16.2 21H6.93137C6.32555 21 6.02265 21 5.88238 20.8802C5.76068 20.7763 5.69609 20.6203 5.70865 20.4608C5.72312 20.2769 5.93731 20.0627 6.36569 19.6343L14.8686 11.1314C15.2646 10.7354 15.4627 10.5373 15.691 10.4632C15.8918 10.3979 16.1082 10.3979 16.309 10.4632C16.5373 10.5373 16.7354 10.7354 17.1314 11.1314L21 15V16.2M16.2 21C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2M16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3H16.2C17.8802 3 18.7202 3 19.362 3.32698C19.9265 3.6146 20.3854 4.07354 20.673 4.63803C21 5.27976 21 6.11984 21 7.8V16.2M10.5 8.5C10.5 9.60457 9.60457 10.5 8.5 10.5C7.39543 10.5 6.5 9.60457 6.5 8.5C6.5 7.39543 7.39543 6.5 8.5 6.5C9.60457 6.5 10.5 7.39543 10.5 8.5Z',
                        stroke: 'currentColor',
                        strokeWidth: '2',
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round'
                    })))
                ]),


                h('div', {
                    className: 'fotogrids-item-url-item__fields'
                }, [

                    h('div', {
                        className: 'fotogrids-item-url-item__url-field'
                    }, [
                        h('label', {
                            className: 'fotogrids-item-url-item__label'
                        }, __('Link', 'fotogrids')),
                        h('div', {
                            className: 'fotogrids-url-input'
                        }, [
                            h('input', {
                                key: currentUrl,
                                type: 'url',
                                defaultValue: currentUrl,
                                placeholder: __('External URL', 'fotogrids'),
                                className: 'fotogrids-input',
                                onBlur: (e) => {
                                    const newUrl = e.target.value;
                                    const validation = validateUrl(newUrl);

                                    if (validation.valid && newUrl) {
                                        e.target.className = 'fotogrids-input fotogrids-input--valid';
                                    } else if (!validation.valid && newUrl) {
                                        e.target.className = 'fotogrids-input fotogrids-input--invalid';
                                    } else {
                                        e.target.className = 'fotogrids-input';
                                    }

                                    const validationEl = e.target.nextElementSibling;
                                    if (validationEl && validationEl.classList.contains('fotogrids-url-validation')) {
                                        if (validation.message && newUrl) {
                                            validationEl.textContent = validation.message;
                                            validationEl.className = `fotogrids-url-validation ${validation.valid ? 'fotogrids-url-validation--valid' : 'fotogrids-url-validation--invalid'}`;
                                            validationEl.style.display = 'block';
                                        } else {
                                            validationEl.style.display = 'none';
                                        }
                                    }

                                    if (validation.valid || !newUrl.trim()) {
                                        updateItemUrl(itemId, newUrl);
                                    }
                                },
                                disabled: isDisabled || isSaving
                            }),
                            h('div', {
                                className: 'fotogrids-url-validation',
                                style: { display: 'none' }
                            }),
                            isSaving && h('div', {
                                className: 'fotogrids-saving-indicator'
                            }, __('Saving...', 'fotogrids'))
                        ])
                    ]),


                    h('div', {
                        className: 'fotogrids-item-url-item__target-field'
                    }, [
                        h('label', {
                            className: 'fotogrids-item-url-item__label'
                        }, __('Target', 'fotogrids')),
                        h('div', {
                            className: 'fotogrids-target-button-group'
                        }, [
                            h('button', {
                                type: 'button',
                                className: `fotogrids-target-button ${currentTarget === 'global' ? 'fg-is-active' : ''}`,
                                onClick: () => updateItemUrl(itemId, currentUrl, 'global'),
                                disabled: isDisabled || isSaving
                            }, [
                                h('span', {
                                    className: 'fotogrids-target-button__main-label'
                                }, __('Default', 'fotogrids')),
                                h('span', {
                                    className: 'fotogrids-target-button__sub-label'
                                }, globalTarget === '_self' ? __('Same Tab', 'fotogrids') : __('New Tab', 'fotogrids'))
                            ]),
                            h('button', {
                                type: 'button',
                                className: `fotogrids-target-button ${currentTarget === '_self' ? 'fg-is-active' : ''}`,
                                onClick: () => updateItemUrl(itemId, currentUrl, '_self'),
                                disabled: isDisabled || isSaving
                            }, [
                                h('span', {
                                    className: 'fotogrids-target-button__icon'
                                }, renderIcon('check_square')),
                                h('span', {
                                    className: 'fotogrids-target-button__label'
                                }, __('Same Tab', 'fotogrids'))
                            ]),
                            h('button', {
                                type: 'button',
                                className: `fotogrids-target-button ${currentTarget === '_blank' ? 'fg-is-active' : ''}`,
                                onClick: () => updateItemUrl(itemId, currentUrl, '_blank'),
                                disabled: isDisabled || isSaving
                            }, [
                                h('span', {
                                    className: 'fotogrids-target-button__icon'
                                }, renderIcon('plus_square')),
                                h('span', {
                                    className: 'fotogrids-target-button__label'
                                }, __('New Tab', 'fotogrids'))
                            ])
                        ])
                    ])
                ])
            ]);
        }))
    ]);
};
