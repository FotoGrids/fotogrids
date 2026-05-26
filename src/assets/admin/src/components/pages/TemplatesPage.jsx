/**
 * Templates Page Component
 *
 * Displays pre-defined and user-created templates for galleries and albums.
 * Templates are organized by type (Gallery/Album) with side tabs.
 */
import React, { useState, useEffect } from 'react';
import PreviewTemplateModal from '../templates/PreviewTemplateModal';
import ApplyTemplateModal from '../templates/ApplyTemplateModal';

const { __ } = wp.i18n;

const TemplatesPage = () => {
    const [activeTab, setActiveTab] = useState('gallery');
    const [templates, setTemplates] = useState({ gallery: [], album: [] });
    const [userTemplates, setUserTemplates] = useState({ gallery: [], album: [] });
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [showUserTemplates, setShowUserTemplates] = useState(false);
    const [showFotoGridsTemplates, setShowFotoGridsTemplates] = useState(true);
    const isProActive = window.fotogridsSettings?.isProActive || false;

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const response = await wp.apiFetch({
                path: '/fotogrids/v1/templates',
                method: 'GET',
            });

            if (response.templates) {
                const galleryTemplates = response.templates.filter(t => t.category === 'gallery' || !t.category);
                const albumTemplates = response.templates.filter(t => t.category === 'album');

                setTemplates({
                    gallery: galleryTemplates.filter(t => !t.isUserTemplate),
                    album: albumTemplates.filter(t => !t.isUserTemplate),
                });

                setUserTemplates({
                    gallery: galleryTemplates.filter(t => t.isUserTemplate),
                    album: albumTemplates.filter(t => t.isUserTemplate),
                });
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            if (window.fotogridsToast) {
                window.fotogridsToast.error(__('Failed to load templates.', 'fotogrids'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = (template) => {
        setSelectedTemplate(template);
        setShowPreviewModal(true);
    };

    const handleApply = (template) => {
        setSelectedTemplate(template);
        setShowApplyModal(true);
    };

    const handleDownload = async (template) => {
        if (!isProActive && template.type !== 'free') {
            if (window.FotoGridsUpgrade) {
                window.FotoGridsUpgrade.launch();
            }
            return;
        }

        try {
            const response = await wp.apiFetch({
                path: `/fotogrids/v1/templates/${template.id}/download`,
                method: 'GET',
            });

            if (response.success && response.template) {
                // Template downloaded, could show success message
                if (window.fotogridsToast) {
                    window.fotogridsToast.success(__('Template downloaded successfully.', 'fotogrids'));
                }
                // Reload templates to show newly downloaded template
                loadTemplates();
            } else {
                throw new Error(response.message || __('Failed to download template.', 'fotogrids'));
            }
        } catch (error) {
            console.error('Error downloading template:', error);
            if (window.fotogridsToast) {
                window.fotogridsToast.error(error.message || __('Failed to download template.', 'fotogrids'));
            }
        }
    };

    const renderIcon = (iconName) => {
        const icons = window.FotoGridsIcons || {};
        const iconSvg = icons[iconName];
        if (!iconSvg) return null;
        return <span className="fotogrids-icon" dangerouslySetInnerHTML={{ __html: iconSvg }} />;
    };

    const renderTemplateCard = (template) => {
        const isProTemplate = template.type !== 'free' && !isProActive;

        return (
            <div key={template.id} className="fotogrids-template-card">
                {isProTemplate && (
                    <span className="fotogrids-pro-badge fotogrids-pro-badge__absolute">
                        {__('PRO', 'fotogrids')}
                    </span>
                )}

                <div
                    className="fotogrids-template-card__preview"
                    onClick={() => handlePreview(template)}
                    style={{ cursor: 'pointer' }}
                >
                    {template.preview_icon ? (
                        <div className="fotogrids-template-card__preview-icon">
                            {renderIcon(template.preview_icon)}
                        </div>
                    ) : template.preview ? (
                        <img src={template.preview} alt={template.name} />
                    ) : (
                        <div className="fotogrids-template-card__preview-placeholder">
                            {renderIcon('image')}
                        </div>
                    )}
                </div>

                <div className="fotogrids-template-card__content">
                    <h3>{template.name}</h3>
                    {template.description && (
                        <p>{template.description}</p>
                    )}

                    <div className="fotogrids-template-card__actions">
                        <button
                            type="button"
                            className="fotogrids-button fotogrids-button--secondary fotogrids-button--small"
                            onClick={() => handlePreview(template)}
                        >
                            {__('Preview', 'fotogrids')}
                        </button>
                        <button
                            type="button"
                            className="fotogrids-button fotogrids-button--primary fotogrids-button--small"
                            onClick={() => handleApply(template)}
                            disabled={isProTemplate}
                        >
                            {__('Apply', 'fotogrids')}
                        </button>
                        {template.type !== 'free' && (
                            <button
                                type="button"
                                className="fotogrids-button fotogrids-button--secondary fotogrids-button--small"
                                onClick={() => handleDownload(template)}
                            >
                                {__('Download', 'fotogrids')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const infoItems = [
        {
            key: 'time',
            title: __('Save valuable time', 'fotogrids'),
            description: __(
                'Launch new galleries in minutes using ready-made layouts instead of rebuilding designs from scratch.',
                'fotogrids'
            ),
        },
        {
            key: 'consistency',
            title: __('Keep every gallery on-brand', 'fotogrids'),
            description: __(
                'Apply the same spacing, colors and interactions across multiple galleries and albums with one click.',
                'fotogrids'
            ),
        },
        {
            key: 'userTemplates',
            title: __('Create your own templates', 'fotogrids'),
            description: __(
                'Turn your best-performing gallery and album designs into reusable templates that your whole team can apply in a few clicks.',
                'fotogrids'
            ),
            pro: true,
        },
    ];

    const renderInfoColumn = () => {
        if (isProActive) {
            return null;
        }

        return (
            <aside className="fotogrids-templates-page__info">
                <h2>{__('What are Templates?', 'fotogrids')}</h2>
                <p>
                    {__(
                        'Templates are complete, ready-to-use gallery and album configurations.',
                        'fotogrids'
                    )}
                </p>
                <p>
                    {__(
                        'Templates bundle layout, spacing, hover effects and styling into reusable presets that you can apply in one click.',
                        'fotogrids'
                    )}
                </p>

                <ul className="fotogrids-templates-page__info-list">
                    {infoItems.map((item) => (
                        <li
                            key={item.key}
                            className={`fotogrids-templates-page__info-item ${item.pro ? 'fotogrids-templates-page__info-item--pro' : ''}`}
                            onClick={() => {
                                if (item.pro && window.FotoGridsUpgrade) {
                                    if (window.FotoGridsUpgrade.launchForFeature && window.FotoGridsUpgrade.launchForFeature.templates) {
                                        window.FotoGridsUpgrade.launchForFeature.templates();
                                    } else if (window.FotoGridsUpgrade.launch) {
                                        window.FotoGridsUpgrade.launch('templates');
                                    }
                                }
                            }}
                        >
                            <div className="fotogrids-templates-page__info-item__heading">
                                {renderIcon('check_circle')}
                                <h5>
                                    {item.title}
                                    {item.pro && (
                                        <span className="fotogrids-pro-badge">
                                            {__('Pro', 'fotogrids')}
                                        </span>
                                    )}
                                </h5>
                            </div>
                            <p>{item.description}</p>
                        </li>
                    ))}
                </ul>
            </aside>
        );
    };

    const handleUserTemplatesChange = (checked) => {
        if (!checked && !showFotoGridsTemplates) {
            // Can't uncheck if FotoGrids templates is also unchecked
            return;
        }
        setShowUserTemplates(checked);
    };

    const handleFotoGridsTemplatesChange = (checked) => {
        if (!checked && !showUserTemplates) {
            // Can't uncheck if user templates is also unchecked
            return;
        }
        setShowFotoGridsTemplates(checked);
    };

    const currentTemplates = templates[activeTab] || [];
    const currentUserTemplates = userTemplates[activeTab] || [];
    const filteredUserTemplates = showUserTemplates ? currentUserTemplates : [];
    const filteredTemplates = showFotoGridsTemplates ? currentTemplates : [];
    const activeTemplateType = activeTab === 'gallery'
        ? __('Gallery', 'fotogrids')
        : __('Album', 'fotogrids');

    return (
        <div className="fotogrids-templates-page">
            {!isProActive && renderInfoColumn()}

            <div className="fotogrids-templates-page__main">
                <div className="fotogrids-templates-page__header">
                    <div className="fotogrids-templates-page__tabs">
                        <button
                            type="button"
                            className={`fotogrids-templates-page__tab ${activeTab === 'gallery' ? 'fg-is-active' : ''}`}
                            onClick={() => setActiveTab('gallery')}
                        >
                            <span className="fotogrids-templates-page__tab__icon">
                                {renderIcon('layout_3x3')}
                            </span>
                            <span className="fotogrids-templates-page__tab__label">
                                {__('Gallery Templates', 'fotogrids')}
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`fotogrids-templates-page__tab ${activeTab === 'album' ? 'fg-is-active' : ''}`}
                            onClick={() => setActiveTab('album')}
                        >
                            <span className="fotogrids-templates-page__tab__icon">
                                {renderIcon('layout_2x2')}
                            </span>
                            <span className="fotogrids-templates-page__tab__label">
                                {__('Album Templates', 'fotogrids')}
                            </span>
                        </button>
                    </div>

                    <div className="fotogrids-templates-page__types">
                        <label className={`fotogrids-checkbox ${!isProActive ? 'fotogrids-checkbox--disabled' : ''}`}>
                            <input
                                type="checkbox"
                                checked={showUserTemplates}
                                onChange={(e) => handleUserTemplatesChange(e.target.checked)}
                                disabled={!isProActive}
                            />
                            <span className="fotogrids-checkbox__indicator"></span>
                            <span>{__('Your Templates', 'fotogrids')}</span>
                        </label>
                        <label className="fotogrids-checkbox">
                            <input
                                type="checkbox"
                                checked={showFotoGridsTemplates}
                                onChange={(e) => handleFotoGridsTemplatesChange(e.target.checked)}
                            />
                            <span className="fotogrids-checkbox__indicator"></span>
                            <span>{__('FotoGrids Templates', 'fotogrids')}</span>
                        </label>
                    </div>
                </div>

                <div className="fotogrids-templates-page__content">
                    {loading ? (
                        <div className="fotogrids-templates-page--loading">
                            <span className="spinner fg-is-active"></span>
                            <p>{__('Loading templates...', 'fotogrids')}</p>
                        </div>
                    ) : (
                        <>
                            {filteredUserTemplates.length > 0 && (
                                <div className="fotogrids-templates-page__section">
                                    <h2>{__('My Templates', 'fotogrids')}</h2>
                                    <div className="fotogrids-templates-page__grid">
                                        {filteredUserTemplates.map(renderTemplateCard)}
                                    </div>
                                </div>
                            )}

                            {filteredTemplates.length > 0 && (
                                <div className="fotogrids-templates-page__section">
                                    {filteredUserTemplates.length > 0 && (
                                        <h2>
                                            {__('FotoGrids {type} Templates', 'fotogrids').replace('{type}', activeTemplateType)}
                                        </h2>
                                    )}
                                    <div className="fotogrids-templates-page__grid">
                                        {filteredTemplates.map(renderTemplateCard)}
                                    </div>
                                </div>
                            )}

                            {filteredUserTemplates.length === 0 && filteredTemplates.length === 0 && (
                                <p className="fotogrids-templates-page--empty">
                                    {__('No templates available.', 'fotogrids')}
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>

            {showPreviewModal && selectedTemplate && (
                <PreviewTemplateModal
                    template={selectedTemplate}
                    onClose={() => setShowPreviewModal(false)}
                    onApply={(template) => {
                        setShowPreviewModal(false);
                        handleApply(template);
                    }}
                />
            )}

            {showApplyModal && selectedTemplate && (
                <ApplyTemplateModal
                    template={selectedTemplate}
                    isOpen={showApplyModal}
                    onClose={() => setShowApplyModal(false)}
                    onSuccess={() => {
                        setShowApplyModal(false);
                        loadTemplates();
                    }}
                />
            )}
        </div>
    );
};

export default TemplatesPage;
