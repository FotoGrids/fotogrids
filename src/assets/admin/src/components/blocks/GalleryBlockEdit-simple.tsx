import React, { useState, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import { 
    Button,
    PanelBody,
    SelectControl,
    ToggleControl,
    Placeholder,
    Spinner,
    Notice
} from '@wordpress/components';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { BlockEditProps } from '@wordpress/blocks';
import apiFetch from '@wordpress/api-fetch';

interface Gallery {
    id: number;
    title: { rendered: string };
    gallery_images?: any[];
}

interface Template {
    id: string;
    name: string;
    preview: string;
}

interface GalleryBlockAttributes {
    galleryId: number;
    template: string;
    cols: number;
    captions: boolean;
    lightbox: boolean;
    lazy: boolean;
}

const GalleryBlockEdit: React.FC<BlockEditProps<GalleryBlockAttributes>> = ({ 
    attributes, 
    setAttributes 
}) => {
    const { galleryId, template, cols, captions, lightbox, lazy } = attributes;
    
    const [galleries, setGalleries] = useState<Gallery[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const blockProps = useBlockProps();

    useEffect(() => {
        loadGalleries();
        loadTemplates();
    }, []);

    const loadGalleries = async () => {
        try {
            const response = await apiFetch<Gallery[]>({
                path: '/fotogrids/v1/galleries'
            });
            setGalleries(response);
        } catch (err) {
            setError(__('Failed to load galleries', 'fotogrids'));
        }
    };

    const loadTemplates = async () => {
        try {
            const response = await apiFetch<Template[]>({
                path: '/fotogrids/v1/templates'
            });
            setTemplates(response);
            setLoading(false);
        } catch (err) {
            setError(__('Failed to load templates', 'fotogrids'));
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div {...blockProps}>
                <Placeholder
                    label={__('FotoGrids Gallery', 'fotogrids')}
                >
                    <Spinner />
                    <p>{__('Loading galleries and templates...', 'fotogrids')}</p>
                </Placeholder>
            </div>
        );
    }

    if (error) {
        return (
            <div {...blockProps}>
                <Notice status="error">
                    {error}
                    <Button 
                        variant="primary" 
                        onClick={() => {
                            setError(null);
                            setLoading(true);
                            loadGalleries();
                            loadTemplates();
                        }}
                    >
                        {__('Retry', 'fotogrids')}
                    </Button>
                </Notice>
            </div>
        );
    }

    // Gallery selection
    if (!galleryId) {
        return (
            <div {...blockProps}>
                <Placeholder
                    label={__('FotoGrids Gallery', 'fotogrids')}
                >
                    <SelectControl
                        label={__('Select Gallery', 'fotogrids')}
                        value=""
                        options={[
                            { label: __('Choose a gallery...', 'fotogrids'), value: '' },
                            ...galleries.map(gallery => ({
                                label: gallery.title.rendered,
                                value: gallery.id.toString()
                            }))
                        ]}
                        onChange={(value) => setAttributes({ galleryId: parseInt(value) })}
                    />
                </Placeholder>
            </div>
        );
    }

    const selectedGallery = galleries.find(g => g.id === galleryId);

    return (
        <>
            <InspectorControls>
                <PanelBody title={__('Gallery Settings', 'fotogrids')}>
                    <SelectControl
                        label={__('Gallery', 'fotogrids')}
                        value={galleryId.toString()}
                        options={galleries.map(gallery => ({
                            label: gallery.title.rendered,
                            value: gallery.id.toString()
                        }))}
                        onChange={(value) => setAttributes({ galleryId: parseInt(value) })}
                    />
                    
                    <SelectControl
                        label={__('Template', 'fotogrids')}
                        value={template}
                        options={templates.map(tmpl => ({
                            label: tmpl.name,
                            value: tmpl.id
                        }))}
                        onChange={(value) => setAttributes({ template: value })}
                    />
                    
                    <SelectControl
                        label={__('Columns', 'fotogrids')}
                        value={cols.toString()}
                        options={[
                            { label: __('1 Column', 'fotogrids'), value: '1' },
                            { label: __('2 Columns', 'fotogrids'), value: '2' },
                            { label: __('3 Columns', 'fotogrids'), value: '3' },
                            { label: __('4 Columns', 'fotogrids'), value: '4' },
                            { label: __('5 Columns', 'fotogrids'), value: '5' },
                            { label: __('6 Columns', 'fotogrids'), value: '6' },
                        ]}
                        onChange={(value) => setAttributes({ cols: parseInt(value) })}
                    />
                    
                    <ToggleControl
                        label={__('Show Captions', 'fotogrids')}
                        checked={captions}
                        onChange={(value) => setAttributes({ captions: value })}
                    />
                    
                    <ToggleControl
                        label={__('Enable Lightbox', 'fotogrids')}
                        checked={lightbox}
                        onChange={(value) => setAttributes({ lightbox: value })}
                    />
                    
                    <ToggleControl
                        label={__('Lazy Loading', 'fotogrids')}
                        checked={lazy}
                        onChange={(value) => setAttributes({ lazy: value })}
                    />
                </PanelBody>
            </InspectorControls>

            <div {...blockProps}>
                <div className="fotogrids-block-preview">
                    <h3>{selectedGallery?.title.rendered}</h3>
                    <p>{__('Template:', 'fotogrids')} {template}</p>
                    <p>{__('Columns:', 'fotogrids')} {cols}</p>
                    {selectedGallery?.gallery_images && (
                        <div className={`fotogrids-preview fotogrids-${template}`}>
                            {selectedGallery.gallery_images.slice(0, 6).map((image: any, index: number) => (
                                <div key={index} className="fotogrids-preview-item">
                                    <img 
                                        src={image.thumbnail || image.url} 
                                        alt={image.alt || image.title}
                                        style={{ width: '100%', height: 'auto' }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default GalleryBlockEdit;
