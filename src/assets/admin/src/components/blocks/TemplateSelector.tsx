/**
 * Template Selector Component
 *
 * Interface for selecting gallery templates in Gutenberg block
 */

import React from 'react';
import {
    Card,
    CardBody,
    CardMedia,
    CardHeader
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

interface Template {
    id: string;
    name: string;
    description: string;
    type: string;
    preview: string;
}

interface TemplateSelectorProps {
    templates: Template[];
    selectedTemplate: string;
    onTemplateChange: (template: string) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
    templates,
    selectedTemplate,
    onTemplateChange,
}) => {
    const freeTemplates = templates.filter(t => t.type === 'free');
    const proTemplates = templates.filter(t => t.type !== 'free');

    const renderTemplate = (template: Template) => (
        <Card
            key={template.id}
            className={`fotogrids-template-card ${
                selectedTemplate === template.id ? 'is-selected' : ''
            }`}
            onClick={() => onTemplateChange(template.id)}
            style={{ cursor: 'pointer' }}
        >
            <CardMedia>
                <div style={{ position: 'relative' }}>
                    <img
                        src={template.preview}
                        alt={template.name}
                        style={{
                            width: '100%',
                            height: '100px',
                            objectFit: 'cover',
                            backgroundColor: '#f0f0f0',
                        }}
                        onError={(e) => {
                            // Fallback for missing preview items
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                                parent.innerHTML = `
                                    <div style="
                                        width: 100%;
                                        height: 100px;
                                        background: #f0f0f0;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        font-size: 12px;
                                        color: #666;
                                    ">
                                        ${template.name} Preview
                                    </div>
                                `;
                            }
                        }}
                    />
                    {template.type !== 'free' && (
                        <div style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                        }}>
                            <span className="fotogrids-pro-badge">
                                {template.type === 'starter' ? __('Starter', 'fotogrids') : __('Pro', 'fotogrids')}
                            </span>
                        </div>
                    )}
                </div>
            </CardMedia>
            <CardHeader>
                <h4 style={{
                    margin: 0,
                    fontSize: '13px',
                    fontWeight: 600
                }}>
                    {template.name}
                </h4>
            </CardHeader>
            <CardBody>
                <p style={{
                    margin: 0,
                    fontSize: '11px',
                    color: '#666',
                    lineHeight: 1.3
                }}>
                    {template.description}
                </p>
            </CardBody>
        </Card>
    );

    return (
        <div className="fotogrids-template-selector">
            <div style={{ marginBottom: '8px' }}>
                <strong>{__('Template', 'fotogrids')}</strong>
            </div>

            {/* Free Templates */}
            {freeTemplates.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{
                        fontSize: '12px',
                        color: '#666',
                        marginBottom: '8px',
                        fontWeight: 500
                    }}>
                        {__('Free Templates', 'fotogrids')}
                    </div>
                    <div className="fotogrids-template-grid">
                        {freeTemplates.map(renderTemplate)}
                    </div>
                </div>
            )}

            {/* Pro Templates */}
            {proTemplates.length > 0 && (
                <div>
                    <div style={{
                        fontSize: '12px',
                        color: '#666',
                        marginBottom: '8px',
                        fontWeight: 500
                    }}>
                        {__('Pro Templates', 'fotogrids')}
                    </div>
                    <div className="fotogrids-template-grid">
                        {proTemplates.map(renderTemplate)}
                    </div>
                </div>
            )}

        </div>
    );
};
