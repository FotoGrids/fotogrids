import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';

const { __ } = wp.i18n;

const ApplyTemplateModal = ({ template, isOpen, onClose, onSuccess }) => {
    const [targetType, setTargetType] = useState('gallery');
    const [targetId, setTargetId] = useState('');
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        loadTargets();
    }, [targetType]);

    const loadTargets = async () => {
        setLoading(true);
        try {
            const endpoint = targetType === 'gallery' ? '/fotogrids/v1/galleries' : '/fotogrids/v1/albums';
            const response = await wp.apiFetch({
                path: endpoint,
                method: 'GET',
            });

            if (Array.isArray(response)) {
                setTargets(response.map(item => ({
                    id: item.id,
                    title: item.title || item.name || `#${item.id}`,
                })));
            }
        } catch (error) {
            console.error('Error loading targets:', error);
            if (window.fotogridsToast) {
                window.fotogridsToast.error(__('Failed to load galleries/albums.', 'fotogrids'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        if (!targetId) {
            if (window.fotogridsToast) {
                window.fotogridsToast.error(__('Please select a target to apply the template.', 'fotogrids'));
            }
            return;
        }

        const selectedTarget = targets.find(t => t.id.toString() === targetId.toString());
        const confirmMessage = __(
            'Applying this template will override all existing settings for {{targetName}}. Are you sure you want to proceed?',
            'fotogrids'
        ).replace('{{targetName}}', selectedTarget?.title || targetId);

        if (!confirm(confirmMessage)) {
            return;
        }

        setApplying(true);
        try {
            const response = await wp.apiFetch({
                path: `/fotogrids/v1/templates/${template.id}/apply`,
                method: 'POST',
                data: {
                    target_id: parseInt(targetId),
                    target_type: targetType,
                },
            });

            if (response.success) {
                if (window.fotogridsToast) {
                    window.fotogridsToast.success(
                        response.message || __('Template applied successfully!', 'fotogrids')
                    );
                }
                if (onSuccess) {
                    onSuccess();
                } else {
                    onClose();
                }
            } else {
                throw new Error(response.message || __('Failed to apply template.', 'fotogrids'));
            }
        } catch (error) {
            console.error('Error applying template:', error);
            if (window.fotogridsToast) {
                window.fotogridsToast.error(error.message || __('Failed to apply template.', 'fotogrids'));
            }
        } finally {
            setApplying(false);
        }
    };

    const selectedTarget = targets.find(t => t.id.toString() === targetId.toString());

    const footer = (
        <>
            <button
                type="button"
                className="fotogrids-button fotogrids-button--secondary"
                onClick={onClose}
                disabled={applying}
            >
                {__('Cancel', 'fotogrids')}
            </button>
            <button
                type="button"
                className="fotogrids-button fotogrids-button--primary"
                onClick={handleApply}
                disabled={applying || !targetId || loading}
            >
                {applying ? __('Applying...', 'fotogrids') : __('Apply Template', 'fotogrids')}
            </button>
        </>
    );

    return (
        <Modal
            isOpen={isOpen !== undefined ? isOpen : !!template}
            onClose={onClose}
            title={__('Apply Template', 'fotogrids')}
            size="small"
            footer={footer}
        >
            <p>{__('Select a target to apply the template to:', 'fotogrids')}</p>

            <div className="fotogrids-form-group">
                <label htmlFor="apply-target-type">{__('Target Type', 'fotogrids')}</label>
                <select
                    id="apply-target-type"
                    className="fotogrids-input"
                    value={targetType}
                    onChange={(e) => {
                        setTargetType(e.target.value);
                        setTargetId('');
                    }}
                    disabled={applying || loading}
                >
                    <option value="gallery">{__('Gallery', 'fotogrids')}</option>
                    <option value="album">{__('Album', 'fotogrids')}</option>
                </select>
            </div>

            <div className="fotogrids-form-group">
                <label htmlFor="apply-target-id">
                    {targetType === 'gallery' ? __('Select Gallery', 'fotogrids') : __('Select Album', 'fotogrids')}
                </label>
                {loading ? (
                    <div className="fotogrids-loading">
                        <span className="spinner fg-is-active"></span>
                        <span>{__('Loading...', 'fotogrids')}</span>
                    </div>
                ) : (
                    <select
                        id="apply-target-id"
                        className="fotogrids-input"
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                        disabled={applying}
                    >
                        <option value="">{__('— Select —', 'fotogrids')}</option>
                        {targets.map(target => (
                            <option key={target.id} value={target.id}>
                                {target.title}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {targetId && selectedTarget && (
                <div className="fotogrids-notice fotogrids-notice--warning">
                    <p>
                        {__('Warning: Applying this template will overwrite all existing settings for', 'fotogrids')}
                        <strong> {selectedTarget.title}</strong>.
                        {__(' Are you sure you want to proceed?', 'fotogrids')}
                    </p>
                </div>
            )}
        </Modal>
    );
};

export default ApplyTemplateModal;

