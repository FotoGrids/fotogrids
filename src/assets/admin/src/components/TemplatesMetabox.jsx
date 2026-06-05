/**
 * Templates Metabox Component
 *
 * Allows users to select, apply, and save templates for galleries/albums
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Select from './shared/Select';
import { Button } from './shared/Button';

const { __ } = wp.i18n;

const SaveButton = ({ strings, postId, postType, onSaveSuccess }) => {
    const config = window.fotogridsTemplatesMetabox || {};
    const componentId = config.saveAsTemplateButton;
    const CustomButton = componentId && (window.fotogridsProComponents || {})[componentId];

    if (CustomButton) {
        return React.createElement(CustomButton, {
            strings,
            postId,
            postType,
            onSaveSuccess,
        });
    }

    return (
        <Button
            variant="secondary"
            size="xs"
            disabled
            fullWidth
            ariaLabel={strings.saveAsTemplate}
            onClick={() => {
                if (window.FotoGridsUpgrade?.launchForFeature?.templates) {
                    window.FotoGridsUpgrade.launchForFeature.templates();
                }
            }}
        >
            {strings.saveAsTemplate}
        </Button>
    );
};

const TemplatesMetabox = () => {
    const config = window.fotogridsTemplatesMetabox || {};
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [applying, setApplying] = useState(false);

    const postId = config.postId || 0;
    const postType = config.postType || 'gallery';
    const strings = config.strings || {};
    const editable = config.editable !== false;
    const unauthorisedNotice = config.unauthorisedNotice
        || __('You are viewing templates in read-only mode.', 'fotogrids');

    const hasProSaveButton = config.saveAsTemplateButton &&
        (window.fotogridsProComponents || {})[config.saveAsTemplateButton];

    const proSaveDescriptionRaw = postType === 'album'
        ? strings.proSaveDescriptionAlbum
        : strings.proSaveDescriptionGallery;

    const renderProSaveDescription = (str) => {
        const parts = (str || '').split('{pro_badge}');
        if (parts.length === 1) return str;
        return (
            <>
                {parts[0]}
                <span className="fotogrids-pro-badge">{__('PRO', 'fotogrids')}</span>
                {parts[1]}
            </>
        );
    };

    const DISMISS_KEY = 'fotogrids_templates_metabox_notice_dismissed';
    const [noticeDismissed, setNoticeDismissed] = useState(
        () => localStorage.getItem(DISMISS_KEY) === '1'
    );

    const handleDismissNotice = useCallback(() => {
        localStorage.setItem(DISMISS_KEY, '1');
        setNoticeDismissed(true);
    }, []);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const category = postType === 'gallery' ? 'gallery' : 'album';
            const response = await wp.apiFetch({
                path: `/fotogrids/v1/templates?category=${category}`,
                method: 'GET',
            });

            if (response.templates) {
                setTemplates(response.templates);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            if (window.fotogridsToast) {
                window.fotogridsToast.error(strings.failedToLoadTemplates);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async (template) => {
        if (!confirm(strings.confirmApply)) {
            return;
        }

        setApplying(true);
        try {
            const response = await wp.apiFetch({
                path: `/fotogrids/v1/templates/${template.id}/apply`,
                method: 'POST',
                data: {
                    post_id: postId,
                    post_type: postType,
                },
            });

            if (response.success) {
                if (window.fotogridsToast) {
                    window.fotogridsToast.success(response.message || strings.templateApplied);
                }
                window.location.reload();
            } else {
                throw new Error(response.message || strings.failedToApplyTemplate);
            }
        } catch (error) {
            console.error('Error applying template:', error);
            if (window.fotogridsToast) {
                window.fotogridsToast.error(error.message || strings.failedToApplyTemplate);
            }
        } finally {
            setApplying(false);
        }
    };

    const handleGoToTemplatesLibrary = () => {
        const templatesUrl = config.templatesUrl || 'admin.php?page=fotogrids-templates';
        const tab = postType === 'gallery' ? 'gallery' : 'album';
        window.open(`${templatesUrl}&tab=${tab}`, '_blank');
    };

    const selectOptions = useMemo(() => {
        const isPro = config.isPro || window.fotogridsIsPro === true;
        const availableTemplates = isPro
            ? templates
            : templates.filter(t => t.type !== 'pro');
        const userTemplates = availableTemplates.filter(t => t.isUserTemplate);
        const fotogridsTemplates = availableTemplates.filter(t => !t.isUserTemplate);

        const groups = [];

        if (userTemplates.length > 0) {
            groups.push({
                label: strings.userTemplates,
                options: userTemplates.map(t => ({
                    value: t.id,
                    label: t.name,
                    template: t,
                })),
            });
        }

        if (fotogridsTemplates.length > 0) {
            groups.push({
                label: userTemplates.length > 0 ? strings.fotogridsTemplates : null,
                options: fotogridsTemplates.map(t => ({
                    value: t.id,
                    label: t.name,
                    template: t,
                })),
            });
        }

        return groups;
    }, [templates, config.isPro, strings.userTemplates, strings.fotogridsTemplates]);

    const hasSelectOptions = selectOptions.some(g => g.options?.length > 0);

    // Clear selection if selected template was filtered out (e.g. Pro template when no Pro)
    useEffect(() => {
        if (selectedTemplate && !hasSelectOptions) {
            setSelectedTemplate(null);
        } else if (selectedTemplate && hasSelectOptions) {
            const options = selectOptions.flatMap(g => g.options || []);
            const stillAvailable = options.some(opt => opt.template?.id === selectedTemplate.id);
            if (!stillAvailable) {
                setSelectedTemplate(null);
            }
        }
    }, [selectOptions, hasSelectOptions, selectedTemplate]);

    const handleSelectChange = (value, option) => {
        if (option) {
            setSelectedTemplate(option.template);
        } else {
            setSelectedTemplate(null);
        }
    };

    const body = (
        <>
            {loading ? (
                <div className="fotogrids-templates-metabox__loading">
                    <span className="spinner fg-is-active"></span>
                    <p>{strings.loading}</p>
                </div>
            ) : (
                <>
                    <div className="fotogrids-templates-metabox__list">
                        {hasSelectOptions ? (
                            <Select
                                value={selectedTemplate?.id || ''}
                                onChange={handleSelectChange}
                                placeholder={strings.selectTemplate}
                                groups={selectOptions}
                                className="fotogrids-templates-metabox__select"
                            />
                        ) : (
                            <p className="fotogrids-templates-metabox__empty">
                                {strings.noTemplates}
                            </p>
                        )}
                    </div>

                    {selectedTemplate && (
                        <Button
                            variant="primary"
                            size="xs"
                            fullWidth
                            onClick={() => handleApply(selectedTemplate)}
                            disabled={applying}
                            busy={applying}
                        >
                            {applying ? strings.applying : strings.applyTemplate}
                        </Button>
                    )}
                </>
            )}

            {noticeDismissed ? (
                    <Button
                        variant="primary"
                        style="outline"
                        size="xs"
                        fullWidth
                        onClick={handleGoToTemplatesLibrary}
                    >
                        {strings.templatesLibrary}
                    </Button>
            ) : (
                <div className="fotogrids-templates-metabox__notice">
                    <button
                        type="button"
                        className="fotogrids-templates-metabox__notice-dismiss"
                        onClick={handleDismissNotice}
                        aria-label={strings.dismiss}
                    >
                        ✕
                    </button>
                    <p>{strings.templatesNoticeDescription}</p>
                    <div className="fotogrids-templates-metabox__pro-actions">
                        <Button
                            variant="primary"
                            style="outline"
                            size="xs"
                            fullWidth
                            onClick={handleGoToTemplatesLibrary}
                        >
                            {strings.templatesLibrary}
                        </Button>
                    </div>
                </div>
            )}

            <div className="fotogrids-templates-metabox__actions">
                <SaveButton
                    strings={strings}
                    postId={postId}
                    postType={postType}
                    onSaveSuccess={loadTemplates}
                />
            </div>

            {!hasProSaveButton && (
                <div className="fotogrids-templates-metabox__notice fotogrids-templates-metabox__notice--pro">
                    <p>{renderProSaveDescription(proSaveDescriptionRaw)}</p>
                </div>
            )}

        </>
    );

    if (!editable) {
        return (
            <div className="fotogrids-templates-metabox--readonly">
                <div className="fotogrids-readonly-notice" role="note">
                    <strong>{__('Read-only', 'fotogrids')}</strong>
                    <span> — {unauthorisedNotice}</span>
                </div>
                <fieldset
                    className="fotogrids-templates-metabox__fieldset"
                    disabled
                    aria-disabled="true"
                >
                    {body}
                </fieldset>
            </div>
        );
    }

    return body;
};

export default TemplatesMetabox;

