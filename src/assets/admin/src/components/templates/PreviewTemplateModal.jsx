import React, { useState } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { FormField } from '../shared/FormField';
import TemplateInfoModal from './TemplateInfoModal';
import ApplyTemplateModal from './ApplyTemplateModal';

const { __ } = wp.i18n;

const PreviewTemplateModal = ({ template, onClose, onApply }) => {
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [pageBackground, setPageBackground] = useState('light'); // 'light', 'dark', 'custom'
    const [pageWidth, setPageWidth] = useState('full'); // 'full', 'custom'

    const isPro = template?.type !== 'free' && template?.type !== undefined;

    const getPreviewUrl = (template) => {
        const baseUrl = window.fotogridsAdmin?.apiUrl || window.location.origin + '/wp-json/';
        const previewUrl = new URL('fotogrids/v1/templates/preview', baseUrl);

        const restNonce = window.fotogridsAdmin?.restNonce || wpApiSettings?.nonce || '';
        if (restNonce) {
            previewUrl.searchParams.append('_wpnonce', restNonce);
        }

        if (template.settings) {
            Object.keys(template.settings).forEach(key => {
                previewUrl.searchParams.append(key, template.settings[key]);
            });
        }

        previewUrl.searchParams.append('template_id', template.id);
        previewUrl.searchParams.append('category', template.category || 'gallery');

        previewUrl.searchParams.append('preview_background', pageBackground);
        previewUrl.searchParams.append('preview_width', pageWidth);

        return previewUrl.toString();
    };

    const getContainerStyle = () => {
        const style = {};
        return style;
    };

    const getIframeStyle = () => {
        const style = {
            border: 'none',
            backgroundColor: 'transparent'
        };

        if (pageWidth === 'custom') {
            style.width = '1000px';
            style.maxWidth = '100%';
            style.margin = '0 auto';
            style.display = 'block';
        } else {
            style.width = '100%';
        }

        return style;
    };

    const modalTitle = template ? `${__('Template Library', 'fotogrids')} - ${template.name}` : '';

    const titleWithBadge = (
        <>
            {modalTitle}
            {isPro && <span className="fotogrids-pro-badge">{__('Pro', 'fotogrids')}</span>}
        </>
    );

    return (
        <>
            <Modal
                isOpen={!!template}
                onClose={onClose}
                size="cover"
                hasSidebar
                sidebarCollapsible
            >
                <Modal.Header size="sm" divider={false}>
                    <Modal.HeaderLogo />
                    <Modal.HeaderTitle level={3}>
                        {titleWithBadge}
                    </Modal.HeaderTitle>
                    <Modal.HeaderActions>
                        <Button
                            variant="secondary"
                            size="xs"
                            iconOnly
                            icon="info_circle"
                            ariaLabel={__('Info', 'fotogrids')}
                            onClick={() => setShowInfoModal(true)}
                        />
                        <Button
                            variant="primary"
                            size="xs"
                            onClick={() => {
                                if (onApply) {
                                    onApply(template);
                                } else {
                                    setShowApplyModal(true);
                                }
                            }}
                        >
                            {__('Apply', 'fotogrids')}
                        </Button>
                    </Modal.HeaderActions>
                </Modal.Header>

                <Modal.Body padding={false}>
                    <Modal.Sidebar>
                        <div className="fotogrids-template-preview-sidebar">
                            {template?.description && (
                                <div className="fotogrids-template-preview--description">
                                    <h4>{__('Description', 'fotogrids')}</h4>
                                    <p>{template.description}</p>
                                </div>
                            )}

                            <div className="fotogrids-template-preview-options">
                                <h4>{__('Preview Options', 'fotogrids')}</h4>

                                <FormField
                                    label={__('Page Background', 'fotogrids')}
                                    htmlFor="preview-background"
                                    layout="column"
                                >
                                    <select
                                        id="preview-background"
                                        value={pageBackground}
                                        onChange={(e) => setPageBackground(e.target.value)}
                                    >
                                        <option value="light">{__('Light', 'fotogrids')}</option>
                                        <option value="dark">{__('Dark', 'fotogrids')}</option>
                                        <option value="custom">{__('Custom', 'fotogrids')}</option>
                                    </select>
                                </FormField>

                                <FormField
                                    label={__('Page Layout Width', 'fotogrids')}
                                    htmlFor="preview-width"
                                    layout="column"
                                >
                                    <select
                                        id="preview-width"
                                        value={pageWidth}
                                        onChange={(e) => setPageWidth(e.target.value)}
                                    >
                                        <option value="full">{__('Full Screen', 'fotogrids')}</option>
                                        <option value="custom">{__('Custom', 'fotogrids')}</option>
                                    </select>
                                </FormField>
                            </div>
                        </div>
                    </Modal.Sidebar>

                    <Modal.Main>
                        <div className="fotogrids-template-preview--container" style={getContainerStyle()}>
                            <iframe
                                src={getPreviewUrl(template)}
                                title={template?.name}
                                className="fotogrids-template-preview--iframe"
                                style={getIframeStyle()}
                                loading="lazy"
                            />
                        </div>
                    </Modal.Main>
                </Modal.Body>
            </Modal>

            <TemplateInfoModal
                isOpen={showInfoModal}
                onClose={() => setShowInfoModal(false)}
            />

            <ApplyTemplateModal
                template={template}
                isOpen={showApplyModal && !onApply}
                onClose={() => setShowApplyModal(false)}
                onSuccess={() => {
                    setShowApplyModal(false);
                    onClose();
                }}
            />
        </>
    );
};

export default PreviewTemplateModal;

