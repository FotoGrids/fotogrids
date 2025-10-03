import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Card, CardBody, Button } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { Template } from '../types';

const TemplatesPage = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const response = await apiFetch({ 
                path: '/fotogrids/v1/templates' 
            }) as { templates: Template[] };
            setTemplates(response.templates);
        } catch (error) {
            console.error('Error fetching templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const getTemplateTypeLabel = (type: string) => {
        switch (type) {
            case 'free':
                return __('Free', 'fotogrids');
            case 'starter':
                return __('Starter Pro', 'fotogrids');
            case 'expert':
                return __('Expert Pro', 'fotogrids');
            case 'commerce':
                return __('Commerce Pro', 'fotogrids');
            default:
                return type;
        }
    };

    const getTemplateTypeClass = (type: string) => {
        return `template-type template-type-${type}`;
    };

    const handleTemplateSelect = (template: Template) => {
        // This would be implemented to apply template to a gallery
        console.log('Selected template:', template);
    };

    if (loading) {
        return <div className="loading">{__('Loading templates...', 'fotogrids')}</div>;
    }

    return (
        <div className="fotogrids-templates-page">
            <div className="templates-header">
                <p className="description">
                    {__(
                        'Choose from our collection of beautiful gallery templates. Pro templates require a valid license.',
                        'fotogrids'
                    )}
                </p>
            </div>

            <div className="templates-grid">
                {templates.map((template) => (
                    <Card key={template.id} className="template-card">
                        <div className="template-preview">
                            <img 
                                src={template.preview} 
                                alt={template.name}
                                onError={(e) => {
                                    // Fallback item if preview doesn't exist
                                    e.currentTarget.src = window.fotogridsAdmin.pluginUrl + 'public/assets/placeholder.jpg';
                                }}
                            />
                            <div className={getTemplateTypeClass(template.type)}>
                                {getTemplateTypeLabel(template.type)}
                            </div>
                        </div>
                        <CardBody>
                            <h3 className="template-name">{template.name}</h3>
                            <p className="template-description">{template.description}</p>
                            <div className="template-actions">
                                {template.type === 'free' ? (
                                    <Button 
                                        variant="primary"
                                        onClick={() => handleTemplateSelect(template)}
                                    >
                                        {__('Use Template', 'fotogrids')}
                                    </Button>
                                ) : (
                                    <div className="pro-template-actions">
                                        <Button 
                                            variant="secondary"
                                            onClick={() => handleTemplateSelect(template)}
                                            disabled
                                        >
                                            {__('Preview', 'fotogrids')}
                                        </Button>
                                        <Button 
                                            variant="primary"
                                            href="admin.php?page=fotogrids-license"
                                        >
                                            {__('Upgrade to Pro', 'fotogrids')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardBody>
                    </Card>
                ))}
            </div>

            {templates.length === 0 && (
                <div className="no-templates">
                    <p>{__('No templates available.', 'fotogrids')}</p>
                </div>
            )}
        </div>
    );
};

export default TemplatesPage;
