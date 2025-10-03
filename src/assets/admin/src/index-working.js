// Simple working admin interface for FotoGrids
import React from 'react';
import ReactDOM from 'react-dom';

// Import admin styles
import './styles/admin.scss';

const { __ } = wp.i18n;

// Professional Welcome Screen Component
const FotoGridsAdmin = () => {
    return React.createElement('div', { className: 'fotogrids-welcome' }, [
        // Header Section
        React.createElement('div', { key: 'header', className: 'fotogrids-welcome-header' }, [
            React.createElement('div', { key: 'branding', className: 'fotogrids-branding' }, [
                React.createElement('h1', { key: 'title' }, [
                    React.createElement('span', { key: 'icon', className: 'dashicons dashicons-format-gallery' }),
                    ' FotoGrids'
                ]),
                React.createElement('p', { key: 'tagline' }, __('Professional Gallery Plugin for WordPress', 'fotogrids'))
            ]),
            React.createElement('div', { key: 'version', className: 'fotogrids-version' }, [
                React.createElement('span', { key: 'badge', className: 'fotogrids-version-badge' }, 'v0.1.0 Free')
            ])
        ]),
        
        // Quick Actions Section
        React.createElement('div', { key: 'actions', className: 'fotogrids-quick-actions' }, [
            React.createElement('h2', { key: 'title' }, __('Quick Actions', 'fotogrids')),
            React.createElement('div', { key: 'action-grid', className: 'fotogrids-action-grid' }, [
                React.createElement('a', { 
                    key: 'new-gallery', 
                    href: 'post-new.php?post_type=fotogrids_gallery',
                    className: 'fotogrids-action-card primary'
                }, [
                    React.createElement('div', { key: 'icon', className: 'action-icon' }, '📷'),
                    React.createElement('h3', { key: 'title' }, __('Create Gallery', 'fotogrids')),
                    React.createElement('p', { key: 'desc' }, __('Start creating your first photo gallery', 'fotogrids'))
                ]),
                React.createElement('a', { 
                    key: 'new-album', 
                    href: 'post-new.php?post_type=fotogrids_album',
                    className: 'fotogrids-action-card'
                }, [
                    React.createElement('div', { key: 'icon', className: 'action-icon' }, '📚'),
                    React.createElement('h3', { key: 'title' }, __('Create Album', 'fotogrids')),
                    React.createElement('p', { key: 'desc' }, __('Organize galleries into albums', 'fotogrids'))
                ]),
                React.createElement('a', { 
                    key: 'templates', 
                    href: 'admin.php?page=fotogrids-templates',
                    className: 'fotogrids-action-card'
                }, [
                    React.createElement('div', { key: 'icon', className: 'action-icon' }, '🎨'),
                    React.createElement('h3', { key: 'title' }, __('Browse Templates', 'fotogrids')),
                    React.createElement('p', { key: 'desc' }, __('Explore gallery layout options', 'fotogrids'))
                ]),
                React.createElement('a', { 
                    key: 'settings', 
                    href: 'admin.php?page=fotogrids-settings',
                    className: 'fotogrids-action-card'
                }, [
                    React.createElement('div', { key: 'icon', className: 'action-icon' }, '⚙️'),
                    React.createElement('h3', { key: 'title' }, __('Settings', 'fotogrids')),
                    React.createElement('p', { key: 'desc' }, __('Configure plugin options', 'fotogrids'))
                ])
            ])
        ]),
        
        // Overview Stats Section
        React.createElement('div', { key: 'overview', className: 'fotogrids-overview' }, [
            React.createElement('h2', { key: 'title' }, __('Overview', 'fotogrids')),
            React.createElement('div', { key: 'stats-grid', className: 'fotogrids-stats-grid' }, [
                React.createElement('div', { key: 'galleries', className: 'fotogrids-stat-card' }, [
                    React.createElement('div', { key: 'number', className: 'stat-number' }, '0'),
                    React.createElement('div', { key: 'label', className: 'stat-label' }, __('Galleries', 'fotogrids'))
                ]),
                React.createElement('div', { key: 'albums', className: 'fotogrids-stat-card' }, [
                    React.createElement('div', { key: 'number', className: 'stat-number' }, '0'),
                    React.createElement('div', { key: 'label', className: 'stat-label' }, __('Albums', 'fotogrids'))
                ]),
                React.createElement('div', { key: 'items', className: 'fotogrids-stat-card' }, [
                    React.createElement('div', { key: 'number', className: 'stat-number' }, '0'),
                    React.createElement('div', { key: 'label', className: 'stat-label' }, __('Items', 'fotogrids'))
                ]),
                React.createElement('div', { key: 'views', className: 'fotogrids-stat-card' }, [
                    React.createElement('div', { key: 'number', className: 'stat-number' }, '0'),
                    React.createElement('div', { key: 'label', className: 'stat-label' }, __('Total Views', 'fotogrids'))
                ])
            ])
        ]),
        
        // Getting Started Section
        React.createElement('div', { key: 'getting-started', className: 'fotogrids-getting-started' }, [
            React.createElement('h2', { key: 'title' }, __('Getting Started', 'fotogrids')),
            React.createElement('div', { key: 'steps', className: 'fotogrids-steps' }, [
                React.createElement('div', { key: 'step1', className: 'fotogrids-step' }, [
                    React.createElement('div', { key: 'number', className: 'step-number' }, '1'),
                    React.createElement('div', { key: 'content', className: 'step-content' }, [
                        React.createElement('h3', { key: 'title' }, __('Create Your First Gallery', 'fotogrids')),
                        React.createElement('p', { key: 'desc' }, __('Click "Create Gallery" to start adding your photos and configure layout options.', 'fotogrids'))
                    ])
                ]),
                React.createElement('div', { key: 'step2', className: 'fotogrids-step' }, [
                    React.createElement('div', { key: 'number', className: 'step-number' }, '2'),
                    React.createElement('div', { key: 'content', className: 'step-content' }, [
                        React.createElement('h3', { key: 'title' }, __('Add Items & Configure', 'fotogrids')),
                        React.createElement('p', { key: 'desc' }, __('Upload items, set titles and descriptions, choose templates and layout options.', 'fotogrids'))
                    ])
                ]),
                React.createElement('div', { key: 'step3', className: 'fotogrids-step' }, [
                    React.createElement('div', { key: 'number', className: 'step-number' }, '3'),
                    React.createElement('div', { key: 'content', className: 'step-content' }, [
                        React.createElement('h3', { key: 'title' }, __('Display on Your Site', 'fotogrids')),
                        React.createElement('p', { key: 'desc' }, __('Use shortcodes or Gutenberg blocks to display galleries on your pages and posts.', 'fotogrids'))
                    ])
                ])
            ])
        ]),
        
        // Pro Features Teaser
        React.createElement('div', { key: 'pro-teaser', className: 'fotogrids-pro-teaser' }, [
            React.createElement('h2', { key: 'title' }, __('Unlock Pro Features', 'fotogrids')),
            React.createElement('div', { key: 'features', className: 'fotogrids-pro-features' }, [
                React.createElement('div', { key: 'feature1', className: 'pro-feature' }, [
                    React.createElement('span', { key: 'icon' }, '🎬'),
                    React.createElement('span', { key: 'text' }, __('Video Support', 'fotogrids'))
                ]),
                React.createElement('div', { key: 'feature2', className: 'pro-feature' }, [
                    React.createElement('span', { key: 'icon' }, '🎨'),
                    React.createElement('span', { key: 'text' }, __('Advanced Templates', 'fotogrids'))
                ]),
                React.createElement('div', { key: 'feature3', className: 'pro-feature' }, [
                    React.createElement('span', { key: 'icon' }, '🗺️'),
                    React.createElement('span', { key: 'text' }, __('Map Integration', 'fotogrids'))
                ]),
                React.createElement('div', { key: 'feature4', className: 'pro-feature' }, [
                    React.createElement('span', { key: 'icon' }, '🛒'),
                    React.createElement('span', { key: 'text' }, __('WooCommerce Integration', 'fotogrids'))
                ])
            ]),
            React.createElement('a', { 
                key: 'upgrade-btn', 
                href: '#',
                className: 'button button-primary button-large'
            }, __('Upgrade to Pro', 'fotogrids'))
        ])
    ]);
};

// Simple Gutenberg block registration
if (typeof wp !== 'undefined' && wp.blocks) {
    const { registerBlockType } = wp.blocks;
    const { __ } = wp.i18n;
    
    registerBlockType('fotogrids/gallery', {
        title: __('FotoGrids Gallery', 'fotogrids'),
        icon: 'format-gallery',
        category: 'media',
        attributes: {
            galleryId: {
                type: 'number',
                default: 0,
            },
            template: {
                type: 'string',
                default: 'grid',
            },
            cols: {
                type: 'number',
                default: 3,
            }
        },
        edit: function(props) {
            const { attributes, setAttributes } = props;
            const { galleryId, template, cols } = attributes;
            
            return React.createElement('div', { className: 'fotogrids-block-placeholder' }, [
                React.createElement('h3', { key: 'title' }, __('FotoGrids Gallery', 'fotogrids')),
                React.createElement('p', { key: 'desc' }, __('Gallery block is ready. Configure in the block settings.', 'fotogrids')),
                React.createElement('p', { key: 'settings' }, [
                    __('Gallery ID: ', 'fotogrids') + galleryId,
                    React.createElement('br', { key: 'br1' }),
                    __('Template: ', 'fotogrids') + template,
                    React.createElement('br', { key: 'br2' }),
                    __('Columns: ', 'fotogrids') + cols
                ])
            ]);
        },
        save: function(props) {
            const { attributes } = props;
            const { galleryId, template, cols } = attributes;
            
            return React.createElement('div', {}, 
                `[fotogrids_gallery id="${galleryId}" template="${template}" cols="${cols}"]`
            );
        },
    });
}

// Simple Templates Page Component
const TemplatesPage = () => {
    return React.createElement('div', { className: 'fotogrids-templates' }, [
        React.createElement('p', { key: 'desc' }, __('Choose from available gallery templates:', 'fotogrids')),
        React.createElement('div', { key: 'templates', className: 'fotogrids-template-grid' }, [
            React.createElement('div', { key: 'grid', className: 'template-card' }, [
                React.createElement('h3', { key: 'title' }, __('Grid Layout', 'fotogrids')),
                React.createElement('p', { key: 'desc' }, __('Classic grid layout with equal-sized items', 'fotogrids')),
                React.createElement('button', { key: 'btn', className: 'button button-primary' }, __('Use Template', 'fotogrids'))
            ]),
            React.createElement('div', { key: 'masonry', className: 'template-card' }, [
                React.createElement('h3', { key: 'title' }, __('Masonry Layout', 'fotogrids')),
                React.createElement('p', { key: 'desc' }, __('Pinterest-style masonry layout', 'fotogrids')),
                React.createElement('button', { key: 'btn', className: 'button button-primary' }, __('Use Template', 'fotogrids'))
            ]),
            React.createElement('div', { key: 'justified', className: 'template-card' }, [
                React.createElement('h3', { key: 'title' }, __('Justified Layout', 'fotogrids')),
                React.createElement('p', { key: 'desc' }, __('Justified rows with consistent heights', 'fotogrids')),
                React.createElement('button', { key: 'btn', className: 'button button-primary' }, __('Use Template', 'fotogrids'))
            ])
        ])
    ]);
};

// Simple Statistics Page Component
const StatsPage = () => {
    return React.createElement('div', { className: 'fotogrids-stats' }, [
        React.createElement('p', { key: 'desc' }, __('Gallery performance statistics:', 'fotogrids')),
        React.createElement('div', { key: 'stats', className: 'stats-grid' }, [
            React.createElement('div', { key: 'views', className: 'stat-card' }, [
                React.createElement('h3', { key: 'title' }, __('Total Views', 'fotogrids')),
                React.createElement('p', { key: 'value', className: 'stat-value' }, '0')
            ]),
            React.createElement('div', { key: 'galleries', className: 'stat-card' }, [
                React.createElement('h3', { key: 'title' }, __('Total Galleries', 'fotogrids')),
                React.createElement('p', { key: 'value', className: 'stat-value' }, '0')
            ])
        ])
    ]);
};

// Advanced Tabbed Settings Page Component
const SettingsPage = () => {
    const [activeTab, setActiveTab] = React.useState('general');
    
    const tabs = [
        { id: 'general', label: __('General', 'fotogrids') },
        { id: 'display', label: __('Display', 'fotogrids') },
        { id: 'performance', label: __('Performance', 'fotogrids') },
        { id: 'advanced', label: __('Advanced', 'fotogrids') },
        { id: 'license', label: __('License', 'fotogrids') }
    ];
    
    const renderTabContent = (tabId) => {
        switch (tabId) {
            case 'general':
                return React.createElement('div', { key: 'general-content' }, [
                    React.createElement('h3', { key: 'title' }, __('General Settings', 'fotogrids')),
                    React.createElement('table', { key: 'table', className: 'form-table' }, [
                        React.createElement('tr', { key: 'default-layout' }, [
                            React.createElement('th', { key: 'th' }, [
                                React.createElement('label', { key: 'label', htmlFor: 'fotogrids-default-layout' }, __('Default Layout', 'fotogrids'))
                            ]),
                            React.createElement('td', { key: 'td' }, [
                                React.createElement('select', { key: 'select', id: 'fotogrids-default-layout', name: 'default_layout' }, [
                                    React.createElement('option', { key: 'grid', value: 'grid' }, __('Grid', 'fotogrids')),
                                    React.createElement('option', { key: 'masonry', value: 'masonry' }, __('Masonry', 'fotogrids')),
                                    React.createElement('option', { key: 'justified', value: 'justified' }, __('Justified', 'fotogrids'))
                                ]),
                                React.createElement('p', { key: 'desc', className: 'description' }, __('Default layout for new galleries', 'fotogrids'))
                            ])
                        ]),
                        React.createElement('tr', { key: 'default-columns' }, [
                            React.createElement('th', { key: 'th' }, [
                                React.createElement('label', { key: 'label', htmlFor: 'fotogrids-default-columns' }, __('Default Columns', 'fotogrids'))
                            ]),
                            React.createElement('td', { key: 'td' }, [
                                React.createElement('input', { key: 'input', type: 'number', id: 'fotogrids-default-columns', name: 'default_columns', min: 1, max: 6, defaultValue: 3 }),
                                React.createElement('p', { key: 'desc', className: 'description' }, __('Default number of columns for grid layouts', 'fotogrids'))
                            ])
                        ]),
                        React.createElement('tr', { key: 'item-sizes' }, [
                            React.createElement('th', { key: 'th' }, [
                                React.createElement('label', { key: 'label', htmlFor: 'fotogrids-item-size' }, __('Item Size', 'fotogrids'))
                            ]),
                            React.createElement('td', { key: 'td' }, [
                                React.createElement('select', { key: 'select', id: 'fotogrids-item-size', name: 'item_size' }, [
                                    React.createElement('option', { key: 'thumbnail', value: 'thumbnail' }, __('Thumbnail (150x150)', 'fotogrids')),
                                    React.createElement('option', { key: 'medium', value: 'medium' }, __('Medium (300x300)', 'fotogrids')),
                                    React.createElement('option', { key: 'large', value: 'large' }, __('Large (1024x1024)', 'fotogrids')),
                                    React.createElement('option', { key: 'full', value: 'full' }, __('Full Size', 'fotogrids'))
                                ]),
                                React.createElement('p', { key: 'desc', className: 'description' }, __('Default item size for gallery thumbnails', 'fotogrids'))
                            ])
                        ])
                    ])
                ]);
            
            case 'display':
                return React.createElement('div', { key: 'display-content' }, [
                    React.createElement('h3', { key: 'title' }, __('Display Settings', 'fotogrids')),
                    React.createElement('table', { key: 'table', className: 'form-table' }, [
                        React.createElement('tr', { key: 'lightbox' }, [
                            React.createElement('th', { key: 'th' }, __('Lightbox', 'fotogrids')),
                            React.createElement('td', { key: 'td' }, [
                                React.createElement('label', { key: 'label' }, [
                                    React.createElement('input', { key: 'input', type: 'checkbox', name: 'enable_lightbox', defaultChecked: true }),
                                    ' ' + __('Enable lightbox by default', 'fotogrids')
                                ]),
                                React.createElement('p', { key: 'desc', className: 'description' }, __('Show items in overlay when clicked', 'fotogrids'))
                            ])
                        ]),
                        React.createElement('tr', { key: 'captions' }, [
                            React.createElement('th', { key: 'th' }, __('Captions', 'fotogrids')),
                            React.createElement('td', { key: 'td' }, [
                                React.createElement('label', { key: 'label' }, [
                                    React.createElement('input', { key: 'input', type: 'checkbox', name: 'show_captions', defaultChecked: true }),
                                    ' ' + __('Show captions by default', 'fotogrids')
                                ]),
                                React.createElement('p', { key: 'desc', className: 'description' }, __('Display item captions below thumbnails', 'fotogrids'))
                            ])
                        ]),
                        React.createElement('tr', { key: 'hover-effects' }, [
                            React.createElement('th', { key: 'th' }, __('Hover Effects', 'fotogrids')),
                            React.createElement('td', { key: 'td' }, [
                                React.createElement('select', { key: 'select', name: 'hover_effect' }, [
                                    React.createElement('option', { key: 'none', value: 'none' }, __('None', 'fotogrids')),
                                    React.createElement('option', { key: 'zoom', value: 'zoom' }, __('Zoom', 'fotogrids')),
                                    React.createElement('option', { key: 'fade', value: 'fade' }, __('Fade', 'fotogrids')),
                                    React.createElement('option', { key: 'slide', value: 'slide' }, __('Slide', 'fotogrids'))
                                ]),
                                React.createElement('p', { key: 'desc', className: 'description' }, __('Effect when hovering over items', 'fotogrids'))
                            ])
                        ])
                    ])
                ]);
            
            case 'performance':
                return React.createElement('div', { key: 'performance-content' }, [
                    React.createElement('h3', { key: 'title' }, __('Performance Settings', 'fotogrids')),
                    React.createElement('table', { key: 'table', className: 'form-table' }, [
                        React.createElement('tr', { key: 'lazy-loading' }, [
                            React.createElement('th', { key: 'th' }, __('Lazy Loading', 'fotogrids')),
                            React.createElement('td', { key: 'td' }, [
                                React.createElement('label', { key: 'label' }, [
                                    React.createElement('input', { key: 'input', type: 'checkbox', name: 'enable_lazy_loading', defaultChecked: true }),
                                    ' ' + __('Enable lazy loading by default', 'fotogrids')
                                ]),
                                React.createElement('p', { key: 'desc', className: 'description' }, __('Load items only when they come into view', 'fotogrids'))
                            ])
                        ]),
                        React.createElement('tr', { key: 'preload' }, [
                            React.createElement('th', { key: 'th' }, [
                                React.createElement('label', { key: 'label', htmlFor: 'fotogrids-preload-count' }, __('Preload Items', 'fotogrids'))
                            ]),
                            React.createElement('td', { key: 'td' }, [
                                React.createElement('input', { key: 'input', type: 'number', id: 'fotogrids-preload-count', name: 'preload_count', min: 0, max: 10, defaultValue: 3 }),
                                React.createElement('p', { key: 'desc', className: 'description' }, __('Number of items to preload ahead of viewport', 'fotogrids'))
                            ])
                        ]),
                        React.createElement('tr', { key: 'cache' }, [
                            React.createElement('th', { key: 'th' }, __('Item Cache', 'fotogrids')),
                            React.createElement('td', { key: 'td' }, [
                                React.createElement('label', { key: 'label' }, [
                                    React.createElement('input', { key: 'input', type: 'checkbox', name: 'enable_cache', defaultChecked: true }),
                                    ' ' + __('Enable item caching', 'fotogrids')
                                ]),
                                React.createElement('p', { key: 'desc', className: 'description' }, __('Cache resized items for better performance', 'fotogrids'))
                            ])
                        ])
                    ])
                ]);
            
            case 'advanced':
                return React.createElement('div', { key: 'advanced-content' }, [
                    React.createElement('h3', { key: 'title' }, __('Advanced Settings', 'fotogrids')),
                    React.createElement('table', { key: 'table', className: 'form-table' }, [
                        React.createElement('tr', { key: 'custom-css' }, [
                            React.createElement('th', { key: 'th' }, [
                                React.createElement('label', { key: 'label', htmlFor: 'fotogrids-custom-css' }, __('Custom CSS', 'fotogrids'))
                            ]),
                            React.createElement('td', { key: 'td' }, [
                                React.createElement('textarea', { key: 'textarea', id: 'fotogrids-custom-css', name: 'custom_css', rows: 10, cols: 50, placeholder: __('/* Add your custom CSS here */', 'fotogrids') }),
                                React.createElement('p', { key: 'desc', className: 'description' }, __('Custom CSS will be applied to all galleries', 'fotogrids'))
                            ])
                        ]),
                        React.createElement('tr', { key: 'delete-data' }, [
                            React.createElement('th', { key: 'th' }, __('Uninstall Options', 'fotogrids')),
                            React.createElement('td', { key: 'td' }, [
                                React.createElement('label', { key: 'label' }, [
                                    React.createElement('input', { key: 'input', type: 'checkbox', name: 'delete_data_on_uninstall' }),
                                    ' ' + __('Delete all data when plugin is uninstalled', 'fotogrids')
                                ]),
                                React.createElement('p', { key: 'desc', className: 'description' }, __('Warning: This will permanently delete all galleries, albums, and settings', 'fotogrids'))
                            ])
                        ])
                    ])
                ]);
            
            case 'license':
                return React.createElement('div', { key: 'license-content' }, [
                    React.createElement('h3', { key: 'title' }, __('License & Pro Features', 'fotogrids')),
                    React.createElement('div', { key: 'license-status', className: 'fotogrids-license-status' }, [
                        React.createElement('p', { key: 'status' }, [
                            React.createElement('strong', { key: 'label' }, __('Status: ', 'fotogrids')),
                            React.createElement('span', { key: 'value', className: 'license-free' }, __('Free Version', 'fotogrids'))
                        ]),
                        React.createElement('div', { key: 'upgrade-section', className: 'fotogrids-upgrade-section' }, [
                            React.createElement('h4', { key: 'title' }, __('Upgrade to Pro', 'fotogrids')),
                            React.createElement('ul', { key: 'features' }, [
                                React.createElement('li', { key: 'f1' }, __('Advanced gallery templates (Slider, Polaroid, etc.)', 'fotogrids')),
                                React.createElement('li', { key: 'f2' }, __('Video gallery support', 'fotogrids')),
                                React.createElement('li', { key: 'f3' }, __('EXIF data display and map integration', 'fotogrids')),
                                React.createElement('li', { key: 'f4' }, __('WooCommerce product galleries', 'fotogrids')),
                                React.createElement('li', { key: 'f5' }, __('Page builder integrations (Elementor, Divi, etc.)', 'fotogrids')),
                                React.createElement('li', { key: 'f6' }, __('Priority support and updates', 'fotogrids'))
                            ]),
                            React.createElement('p', { key: 'cta' }, [
                                React.createElement('a', { 
                                    key: 'btn', 
                                    href: '#',
                                    className: 'button button-primary button-large'
                                }, __('Get Pro Version', 'fotogrids'))
                            ])
                        ])
                    ])
                ]);
            
            default:
                return React.createElement('div', { key: 'default' }, __('Select a tab to configure settings', 'fotogrids'));
        }
    };
    
    return React.createElement('div', { className: 'fotogrids-settings' }, [
        // Tab Navigation
        React.createElement('div', { key: 'nav', className: 'fotogrids-tab-nav' }, [
            React.createElement('h2', { key: 'title', className: 'nav-tab-wrapper' }, 
                tabs.map(tab => 
                    React.createElement('a', {
                        key: tab.id,
                        href: '#',
                        className: `nav-tab ${activeTab === tab.id ? 'nav-tab-active' : ''}`,
                        onClick: (e) => {
                            e.preventDefault();
                            setActiveTab(tab.id);
                        }
                    }, tab.label)
                )
            )
        ]),
        
        // Tab Content
        React.createElement('div', { key: 'content', className: 'fotogrids-tab-content' }, [
            React.createElement('form', { key: 'form', method: 'post', action: 'options.php' }, [
                renderTabContent(activeTab),
                React.createElement('p', { key: 'submit', className: 'submit' }, [
                    React.createElement('button', { key: 'btn', type: 'submit', className: 'button button-primary' }, __('Save Settings', 'fotogrids'))
                ])
            ])
        ])
    ]);
};

// Simple License Page Component
const LicensePage = () => {
    return React.createElement('div', { className: 'fotogrids-license' }, [
        React.createElement('p', { key: 'desc' }, __('FotoGrids License Information:', 'fotogrids')),
        React.createElement('div', { key: 'license-info', className: 'license-info' }, [
            React.createElement('h3', { key: 'title' }, __('Free Version', 'fotogrids')),
            React.createElement('p', { key: 'desc' }, __('You are using the free version of FotoGrids.', 'fotogrids')),
            React.createElement('ul', { key: 'features' }, [
                React.createElement('li', { key: 'f1' }, __('3 gallery templates', 'fotogrids')),
                React.createElement('li', { key: 'f2' }, __('Basic customization options', 'fotogrids')),
                React.createElement('li', { key: 'f3' }, __('WordPress.org support', 'fotogrids'))
            ]),
            React.createElement('p', { key: 'upgrade' }, [
                React.createElement('a', { 
                    key: 'btn', 
                    href: '#', 
                    className: 'button button-primary'
                }, __('Upgrade to Pro', 'fotogrids'))
            ])
        ])
    ]);
};

// Comprehensive Galleries Management Page
const GalleriesPage = () => {
    const [galleries, setGalleries] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [currentView, setCurrentView] = React.useState('list'); // 'list' or 'edit'
    const [editingGallery, setEditingGallery] = React.useState(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    
    // Load galleries on mount
    React.useEffect(() => {
        loadGalleries();
    }, []);
    
    const loadGalleries = () => {
        setLoading(true);
        
        // Check if wp.apiFetch is available
        if (typeof wp === 'undefined' || typeof wp.apiFetch === 'undefined') {
            console.error('wp.apiFetch is not available');
            // Fallback to mock data for now
            setTimeout(() => {
                setGalleries([
                    { id: 1, title: 'Sample Gallery', items: 0, layout: 'grid', status: 'draft', created: new Date().toISOString(), views: 0 }
                ]);
                setLoading(false);
            }, 500);
            return;
        }
        
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        
        console.log('Loading galleries from:', `/fotogrids/v1/admin/galleries?${params.toString()}`);
        
        wp.apiFetch({
            path: `/fotogrids/v1/admin/galleries?${params.toString()}`,
            method: 'GET'
        })
        .then(response => {
            console.log('Galleries response:', response);
            setGalleries(response.galleries || []);
            setLoading(false);
        })
        .catch(error => {
            console.error('Error loading galleries:', error);
            // Fallback to empty array with proper error handling
            setGalleries([]);
            setLoading(false);
        });
    };
    
    const filteredGalleries = galleries.filter(gallery => 
        gallery.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const handleEdit = (gallery) => {
        setEditingGallery(gallery);
        setCurrentView('edit');
    };
    
    const handleDelete = (galleryId) => {
        if (confirm(__('Are you sure you want to delete this gallery?', 'fotogrids'))) {
            wp.apiFetch({
                path: `/fotogrids/v1/admin/galleries/${galleryId}`,
                method: 'DELETE'
            })
            .then(() => {
                setGalleries(galleries.filter(g => g.id !== galleryId));
            })
            .catch(error => {
                console.error('Error deleting gallery:', error);
                alert(__('Error deleting gallery. Please try again.', 'fotogrids'));
            });
        }
    };
    
    const handleSave = () => {
        if (!editingGallery.title) {
            alert(__('Gallery title is required', 'fotogrids'));
            return;
        }
        
        // Check if wp.apiFetch is available
        if (typeof wp === 'undefined' || typeof wp.apiFetch === 'undefined') {
            console.error('wp.apiFetch is not available for saving');
            alert(__('API not available. Please refresh the page.', 'fotogrids'));
            return;
        }
        
        const isNew = !editingGallery.id;
        const method = isNew ? 'POST' : 'PUT';
        const path = isNew ? '/fotogrids/v1/admin/galleries' : `/fotogrids/v1/admin/galleries/${editingGallery.id}`;
        
        console.log('Saving gallery:', { path, method, data: editingGallery });
        
        wp.apiFetch({
            path: path,
            method: method,
            data: {
                title: editingGallery.title,
                status: editingGallery.status || 'draft',
                layout: editingGallery.layout || 'grid',
                columns: editingGallery.columns || 3,
                lightbox: editingGallery.lightbox || false,
                captions: editingGallery.captions || false,
                lazy: editingGallery.lazy || false
            }
        })
        .then(response => {
            console.log('Save response:', response);
            if (isNew && response.id) {
                setEditingGallery({...editingGallery, id: response.id});
            }
            loadGalleries(); // Refresh the list
            alert(__('Gallery saved successfully', 'fotogrids'));
        })
        .catch(error => {
            console.error('Error saving gallery:', error);
            alert(__('Error saving gallery. Please try again.', 'fotogrids'));
        });
    };
    
    const renderGalleryList = () => {
        return React.createElement('div', { key: 'gallery-list' }, [
            // Header with actions
            React.createElement('div', { key: 'header', className: 'fotogrids-page-header' }, [
                React.createElement('div', { key: 'title-section', className: 'fotogrids-title-section' }, [
                    React.createElement('h2', { key: 'title' }, __('Galleries', 'fotogrids')),
                    React.createElement('button', { 
                        key: 'add-btn', 
                        className: 'button button-primary',
                        onClick: () => {
                            setEditingGallery({ id: null, title: '', items: [], layout: 'grid', status: 'draft' });
                            setCurrentView('edit');
                        }
                    }, __('Add New Gallery', 'fotogrids'))
                ]),
                React.createElement('div', { key: 'search-section', className: 'fotogrids-search-section' }, [
                    React.createElement('input', {
                        key: 'search',
                        type: 'text',
                        placeholder: __('Search galleries...', 'fotogrids'),
                        value: searchTerm,
                        onChange: (e) => setSearchTerm(e.target.value),
                        className: 'fotogrids-search-input'
                    })
                ])
            ]),
            
            // Gallery grid
            loading ? 
                React.createElement('div', { key: 'loading', className: 'fotogrids-loading' }, __('Loading galleries...', 'fotogrids')) :
                React.createElement('div', { key: 'grid', className: 'fotogrids-gallery-grid' }, 
                    filteredGalleries.map(gallery =>
                        React.createElement('div', { key: gallery.id, className: 'fotogrids-gallery-card' }, [
                            React.createElement('div', { key: 'thumbnail', className: 'gallery-thumbnail' }, [
                                React.createElement('div', { key: 'placeholder', className: 'thumbnail-placeholder' }, '📷')
                            ]),
                            React.createElement('div', { key: 'info', className: 'gallery-info' }, [
                                React.createElement('h3', { key: 'title', className: 'gallery-title' }, gallery.title),
                                React.createElement('div', { key: 'meta', className: 'gallery-meta' }, [
                                    React.createElement('span', { key: 'items' }, `${gallery.items} ${__('items', 'fotogrids')}`),
                                    React.createElement('span', { key: 'layout' }, gallery.layout),
                                    React.createElement('span', { key: 'views' }, `${gallery.views} ${__('views', 'fotogrids')}`)
                                ]),
                                React.createElement('div', { key: 'status', className: `gallery-status status-${gallery.status}` }, gallery.status)
                            ]),
                            React.createElement('div', { key: 'actions', className: 'gallery-actions' }, [
                                React.createElement('button', { 
                                    key: 'edit', 
                                    className: 'button button-small',
                                    onClick: () => handleEdit(gallery)
                                }, __('Edit', 'fotogrids')),
                                React.createElement('button', { 
                                    key: 'delete', 
                                    className: 'button button-small button-link-delete',
                                    onClick: () => handleDelete(gallery.id)
                                }, __('Delete', 'fotogrids'))
                            ])
                        ])
                    )
                )
        ]);
    };
    
    const renderGalleryEdit = () => {
        if (!editingGallery) return null;
        
        return React.createElement('div', { key: 'gallery-edit' }, [
            // Header
            React.createElement('div', { key: 'header', className: 'fotogrids-page-header' }, [
                React.createElement('div', { key: 'title-section' }, [
                    React.createElement('button', { 
                        key: 'back', 
                        className: 'button',
                        onClick: () => setCurrentView('list')
                    }, '← ' + __('Back to Galleries', 'fotogrids')),
                    React.createElement('h2', { key: 'title' }, 
                        editingGallery.id ? __('Edit Gallery', 'fotogrids') : __('New Gallery', 'fotogrids')
                    )
                ]),
                React.createElement('div', { key: 'actions' }, [
                    React.createElement('button', { key: 'save', className: 'button button-primary', onClick: handleSave }, __('Save Gallery', 'fotogrids')),
                    React.createElement('button', { key: 'cancel', className: 'button', onClick: () => setCurrentView('list') }, __('Cancel', 'fotogrids'))
                ])
            ]),
            
            // Edit form
            React.createElement('div', { key: 'form', className: 'fotogrids-edit-form' }, [
                React.createElement('div', { key: 'main', className: 'fotogrids-form-main' }, [
                    React.createElement('table', { key: 'table', className: 'form-table' }, [
                        React.createElement('tr', { key: 'title' }, [
                            React.createElement('th', { key: 'th' }, React.createElement('label', { key: 'label' }, __('Gallery Title', 'fotogrids'))),
                            React.createElement('td', { key: 'td' }, [
                                React.createElement('input', { 
                                    key: 'input', 
                                    type: 'text', 
                                    value: editingGallery.title,
                                    onChange: (e) => setEditingGallery({...editingGallery, title: e.target.value}),
                                    className: 'regular-text'
                                })
                            ])
                        ]),
                        React.createElement('tr', { key: 'layout' }, [
                            React.createElement('th', { key: 'th' }, React.createElement('label', { key: 'label' }, __('Layout', 'fotogrids'))),
                            React.createElement('td', { key: 'td' }, [
                                React.createElement('select', { 
                                    key: 'select',
                                    value: editingGallery.layout,
                                    onChange: (e) => setEditingGallery({...editingGallery, layout: e.target.value})
                                }, [
                                    React.createElement('option', { key: 'grid', value: 'grid' }, __('Grid', 'fotogrids')),
                                    React.createElement('option', { key: 'masonry', value: 'masonry' }, __('Masonry', 'fotogrids')),
                                    React.createElement('option', { key: 'justified', value: 'justified' }, __('Justified', 'fotogrids'))
                                ])
                            ])
                        ])
                    ])
                ]),
                React.createElement('div', { key: 'items', className: 'fotogrids-items-section' }, [
                    React.createElement('h3', { key: 'title' }, __('Gallery Items', 'fotogrids')),
                    React.createElement('div', { key: 'placeholder', className: 'items-placeholder' }, [
                        React.createElement('p', { key: 'text' }, __('Item management will be integrated here', 'fotogrids')),
                        React.createElement('button', { key: 'btn', className: 'button button-secondary' }, __('Add Items', 'fotogrids'))
                    ])
                ])
            ])
        ]);
    };
    
    return currentView === 'list' ? renderGalleryList() : renderGalleryEdit();
};

// Comprehensive Albums Management Page
const AlbumsPage = () => {
    const [albums, setAlbums] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [currentView, setCurrentView] = React.useState('list');
    const [editingAlbum, setEditingAlbum] = React.useState(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    
    React.useEffect(() => {
        loadAlbums();
    }, []);
    
    const loadAlbums = () => {
        setLoading(true);
        
        // Check if wp.apiFetch is available
        if (typeof wp === 'undefined' || typeof wp.apiFetch === 'undefined') {
            console.error('wp.apiFetch is not available');
            // Fallback to mock data for now
            setTimeout(() => {
                setAlbums([
                    { id: 1, title: 'Sample Album', galleries: 0, status: 'draft', created: new Date().toISOString(), views: 0 }
                ]);
                setLoading(false);
            }, 500);
            return;
        }
        
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        
        console.log('Loading albums from:', `/fotogrids/v1/admin/albums?${params.toString()}`);
        
        wp.apiFetch({
            path: `/fotogrids/v1/admin/albums?${params.toString()}`,
            method: 'GET'
        })
        .then(response => {
            console.log('Albums response:', response);
            setAlbums(response.albums || []);
            setLoading(false);
        })
        .catch(error => {
            console.error('Error loading albums:', error);
            setAlbums([]);
            setLoading(false);
        });
    };
    
    const filteredAlbums = albums.filter(album => 
        album.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const handleEdit = (album) => {
        setEditingAlbum(album);
        setCurrentView('edit');
    };
    
    const handleDelete = (albumId) => {
        if (confirm(__('Are you sure you want to delete this album?', 'fotogrids'))) {
            wp.apiFetch({
                path: `/fotogrids/v1/admin/albums/${albumId}`,
                method: 'DELETE'
            })
            .then(() => {
                setAlbums(albums.filter(a => a.id !== albumId));
            })
            .catch(error => {
                console.error('Error deleting album:', error);
                alert(__('Error deleting album. Please try again.', 'fotogrids'));
            });
        }
    };
    
    const handleSaveAlbum = () => {
        if (!editingAlbum.title) {
            alert(__('Album title is required', 'fotogrids'));
            return;
        }
        
        const isNew = !editingAlbum.id;
        const method = isNew ? 'POST' : 'PUT';
        const path = isNew ? '/fotogrids/v1/admin/albums' : `/fotogrids/v1/admin/albums/${editingAlbum.id}`;
        
        wp.apiFetch({
            path: path,
            method: method,
            data: {
                title: editingAlbum.title,
                status: editingAlbum.status || 'draft',
                layout: editingAlbum.layout || 'grid',
                gallery_ids: editingAlbum.gallery_ids || []
            }
        })
        .then(response => {
            if (isNew && response.id) {
                setEditingAlbum({...editingAlbum, id: response.id});
            }
            loadAlbums(); // Refresh the list
            alert(__('Album saved successfully', 'fotogrids'));
        })
        .catch(error => {
            console.error('Error saving album:', error);
            alert(__('Error saving album. Please try again.', 'fotogrids'));
        });
    };
    
    const renderAlbumList = () => {
        return React.createElement('div', { key: 'album-list' }, [
            React.createElement('div', { key: 'header', className: 'fotogrids-page-header' }, [
                React.createElement('div', { key: 'title-section', className: 'fotogrids-title-section' }, [
                    React.createElement('h2', { key: 'title' }, __('Albums', 'fotogrids')),
                    React.createElement('button', { 
                        key: 'add-btn', 
                        className: 'button button-primary',
                        onClick: () => {
                            setEditingAlbum({ id: null, title: '', galleries: [], status: 'draft' });
                            setCurrentView('edit');
                        }
                    }, __('Add New Album', 'fotogrids'))
                ]),
                React.createElement('div', { key: 'search-section', className: 'fotogrids-search-section' }, [
                    React.createElement('input', {
                        key: 'search',
                        type: 'text',
                        placeholder: __('Search albums...', 'fotogrids'),
                        value: searchTerm,
                        onChange: (e) => setSearchTerm(e.target.value),
                        className: 'fotogrids-search-input'
                    })
                ])
            ]),
            
            loading ? 
                React.createElement('div', { key: 'loading', className: 'fotogrids-loading' }, __('Loading albums...', 'fotogrids')) :
                React.createElement('div', { key: 'grid', className: 'fotogrids-album-grid' }, 
                    filteredAlbums.map(album =>
                        React.createElement('div', { key: album.id, className: 'fotogrids-album-card' }, [
                            React.createElement('div', { key: 'thumbnail', className: 'album-thumbnail' }, [
                                React.createElement('div', { key: 'placeholder', className: 'thumbnail-placeholder' }, '📚')
                            ]),
                            React.createElement('div', { key: 'info', className: 'album-info' }, [
                                React.createElement('h3', { key: 'title', className: 'album-title' }, album.title),
                                React.createElement('div', { key: 'meta', className: 'album-meta' }, [
                                    React.createElement('span', { key: 'galleries' }, `${album.galleries} ${__('galleries', 'fotogrids')}`),
                                    React.createElement('span', { key: 'views' }, `${album.views} ${__('views', 'fotogrids')}`)
                                ]),
                                React.createElement('div', { key: 'status', className: `album-status status-${album.status}` }, album.status)
                            ]),
                            React.createElement('div', { key: 'actions', className: 'album-actions' }, [
                                React.createElement('button', { 
                                    key: 'edit', 
                                    className: 'button button-small',
                                    onClick: () => handleEdit(album)
                                }, __('Edit', 'fotogrids')),
                                React.createElement('button', { 
                                    key: 'delete', 
                                    className: 'button button-small button-link-delete',
                                    onClick: () => handleDelete(album.id)
                                }, __('Delete', 'fotogrids'))
                            ])
                        ])
                    )
                )
        ]);
    };
    
    const renderAlbumEdit = () => {
        if (!editingAlbum) return null;
        
        return React.createElement('div', { key: 'album-edit' }, [
            React.createElement('div', { key: 'header', className: 'fotogrids-page-header' }, [
                React.createElement('div', { key: 'title-section' }, [
                    React.createElement('button', { 
                        key: 'back', 
                        className: 'button',
                        onClick: () => setCurrentView('list')
                    }, '← ' + __('Back to Albums', 'fotogrids')),
                    React.createElement('h2', { key: 'title' }, 
                        editingAlbum.id ? __('Edit Album', 'fotogrids') : __('New Album', 'fotogrids')
                    )
                ]),
                React.createElement('div', { key: 'actions' }, [
                    React.createElement('button', { key: 'save', className: 'button button-primary', onClick: handleSaveAlbum }, __('Save Album', 'fotogrids')),
                    React.createElement('button', { key: 'cancel', className: 'button', onClick: () => setCurrentView('list') }, __('Cancel', 'fotogrids'))
                ])
            ]),
            
            React.createElement('div', { key: 'form', className: 'fotogrids-edit-form' }, [
                React.createElement('table', { key: 'table', className: 'form-table' }, [
                    React.createElement('tr', { key: 'title' }, [
                        React.createElement('th', { key: 'th' }, React.createElement('label', { key: 'label' }, __('Album Title', 'fotogrids'))),
                        React.createElement('td', { key: 'td' }, [
                            React.createElement('input', { 
                                key: 'input', 
                                type: 'text', 
                                value: editingAlbum.title,
                                onChange: (e) => setEditingAlbum({...editingAlbum, title: e.target.value}),
                                className: 'regular-text'
                            })
                        ])
                    ])
                ]),
                React.createElement('div', { key: 'galleries', className: 'fotogrids-galleries-section' }, [
                    React.createElement('h3', { key: 'title' }, __('Album Galleries', 'fotogrids')),
                    React.createElement('div', { key: 'placeholder', className: 'galleries-placeholder' }, [
                        React.createElement('p', { key: 'text' }, __('Gallery selection will be integrated here', 'fotogrids')),
                        React.createElement('button', { key: 'btn', className: 'button button-secondary' }, __('Add Galleries', 'fotogrids'))
                    ])
                ])
            ])
        ]);
    };
    
    return currentView === 'list' ? renderAlbumList() : renderAlbumEdit();
};

// Initialize admin interface
document.addEventListener('DOMContentLoaded', function() {
    // Main admin page
    const adminContainer = document.getElementById('fotogrids-admin-root');
    if (adminContainer && ReactDOM) {
        ReactDOM.render(React.createElement(FotoGridsAdmin), adminContainer);
    }
    
    // Templates page
    const templatesContainer = document.getElementById('fotogrids-templates-page');
    if (templatesContainer && ReactDOM) {
        ReactDOM.render(React.createElement(TemplatesPage), templatesContainer);
    }
    
    // Statistics page
    const statsContainer = document.getElementById('fotogrids-stats-page');
    if (statsContainer && ReactDOM) {
        ReactDOM.render(React.createElement(StatsPage), statsContainer);
    }
    
    // Settings page
    const settingsContainer = document.getElementById('fotogrids-settings-page');
    if (settingsContainer && ReactDOM) {
        ReactDOM.render(React.createElement(SettingsPage), settingsContainer);
    }
    
    // License page
    const licenseContainer = document.getElementById('fotogrids-license-page');
    if (licenseContainer && ReactDOM) {
        ReactDOM.render(React.createElement(LicensePage), licenseContainer);
    }
    
    // Galleries page
    const galleriesContainer = document.getElementById('fotogrids-galleries-page');
    console.log('Galleries container found:', galleriesContainer);
    if (galleriesContainer && ReactDOM) {
        console.log('Mounting GalleriesPage component');
        ReactDOM.render(React.createElement(GalleriesPage), galleriesContainer);
    }
    
    // Albums page
    const albumsContainer = document.getElementById('fotogrids-albums-page');
    console.log('Albums container found:', albumsContainer);
    if (albumsContainer && ReactDOM) {
        console.log('Mounting AlbumsPage component');
        ReactDOM.render(React.createElement(AlbumsPage), albumsContainer);
    }
});

console.log('FotoGrids admin loaded successfully');
console.log('WordPress API availability:', {
    wp: typeof wp,
    apiFetch: typeof wp !== 'undefined' ? typeof wp.apiFetch : 'wp not available',
    fotogridsAdmin: typeof fotogridsAdmin !== 'undefined' ? fotogridsAdmin : 'not available'
});
