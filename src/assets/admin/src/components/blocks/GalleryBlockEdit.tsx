/**
 * Gallery Block Edit Component
 * 
 * Gutenberg block editor interface for FotoGrids Gallery
 */

import React, { useState, useEffect } from 'react';
import { BlockEditProps } from '@wordpress/blocks';
import { 
    InspectorControls, 
    BlockControls,
    useBlockProps,
    BlockAlignmentToolbar 
} from '@wordpress/block-editor';
import {
    PanelBody,
    SelectControl,
    RangeControl,
    ToggleControl,
    TextareaControl,
    Placeholder,
    Spinner,
    Notice,
    ToolbarGroup,
    ToolbarButton,
    Button
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { gallery, edit } from '@wordpress/icons';
import apiFetch from '@wordpress/api-fetch';

import { GalleryBlockAttributes } from '../blocks/gallery-block';
import { GallerySelector } from './GallerySelector';
import { GalleryPreview } from './GalleryPreview';
import { TemplateSelector } from './TemplateSelector';

interface Gallery {
    id: number;
    title: string;
    image_count: number;
    featured_image?: string;
}

interface Template {
    id: string;
    name: string;
    description: string;
    type: string;
    preview: string;
}

export const GalleryBlockEdit: React.FC<BlockEditProps<GalleryBlockAttributes>> = ({
    attributes,
    setAttributes,
    isSelected,
}) => {
    const [galleries, setGalleries] = useState<Gallery[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isLoadingGalleries, setIsLoadingGalleries] = useState(true);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSelectingGallery, setIsSelectingGallery] = useState(!attributes.galleryId);

    const blockProps = useBlockProps({
        className: `fotogrids-block-gallery align${attributes.align || 'none'}`,
    });

    // Load galleries and templates on mount
    useEffect(() => {
        loadGalleries();
        loadTemplates();
    }, []);

    const loadGalleries = async () => {
        try {
            setIsLoadingGalleries(true);
            const response = await apiFetch({
                path: '/fotogrids/v1/galleries',
            }) as Gallery[];
            setGalleries(response);
        } catch (err) {
            setError(__('Failed to load galleries. Please check your connection.', 'fotogrids'));
            console.error('Failed to load galleries:', err);
        } finally {
            setIsLoadingGalleries(false);
        }
    };

    const loadTemplates = async () => {
        try {
            setIsLoadingTemplates(true);
            const response = await apiFetch({
                path: '/fotogrids/v1/templates',
            }) as Template[];
            setTemplates(response);
        } catch (err) {
            setError(__('Failed to load templates.', 'fotogrids'));
            console.error('Failed to load templates:', err);
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    const selectedGallery = galleries.find(g => g.id === attributes.galleryId);
    const selectedTemplate = templates.find(t => t.id === attributes.template);

    // Gallery selection options
    const galleryOptions = [
        { label: __('Select a gallery...', 'fotogrids'), value: 0 },
        ...galleries.map(gallery => ({
            label: `${gallery.title} (${gallery.image_count} images)`,
            value: gallery.id,
        })),
    ];

    // Template selection options
    const templateOptions = templates.map(template => ({
        label: template.name,
        value: template.id,
    }));

    const handleGallerySelect = (galleryId: number) => {
        setAttributes({ galleryId });
        setIsSelectingGallery(false);
    };

    const handleTemplateChange = (template: string) => {
        setAttributes({ template });
    };

    const handleAlignmentChange = (align: string) => {
        setAttributes({ align });
    };

    // Render loading state
    if (isLoadingGalleries || isLoadingTemplates) {
        return (
            <div {...blockProps}>
                <Placeholder
                    icon={gallery}
                    label={__('FotoGrids Gallery', 'fotogrids')}
                    instructions={__('Loading galleries and templates...', 'fotogrids')}
                >
                    <Spinner />
                </Placeholder>
            </div>
        );
    }

    // Render error state
    if (error) {
        return (
            <div {...blockProps}>
                <Notice status="error" isDismissible={false}>
                    {error}
                    <Button 
                        isPrimary 
                        onClick={() => {
                            setError(null);
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

    // Render gallery selection state
    if (isSelectingGallery || !attributes.galleryId || !selectedGallery) {
        return (
            <>
                <InspectorControls>
                    <PanelBody title={__('Gallery Settings', 'fotogrids')}>
                        <SelectControl
                            label={__('Select Gallery', 'fotogrids')}
                            value={attributes.galleryId}
                            options={galleryOptions}
                            onChange={(value) => handleGallerySelect(parseInt(value, 10))}
                        />
                    </PanelBody>
                </InspectorControls>

                <div {...blockProps}>
                    <GallerySelector
                        galleries={galleries}
                        selectedGalleryId={attributes.galleryId}
                        onGallerySelect={handleGallerySelect}
                        onCreateNew={() => {
                            // Redirect to gallery creation
                            window.open('/wp-admin/admin.php?page=fotogrids&action=new', '_blank');
                        }}
                    />
                </div>
            </>
        );
    }

    // Render main edit interface
    return (
        <>
            <BlockControls>
                <BlockAlignmentToolbar
                    value={attributes.align}
                    onChange={handleAlignmentChange}
                    controls={['left', 'center', 'right', 'wide', 'full']}
                />
                <ToolbarGroup>
                    <ToolbarButton
                        icon={edit}
                        label={__('Change Gallery', 'fotogrids')}
                        onClick={() => setIsSelectingGallery(true)}
                    />
                </ToolbarGroup>
            </BlockControls>

            <InspectorControls>
                <PanelBody title={__('Gallery Settings', 'fotogrids')}>
                    <SelectControl
                        label={__('Gallery', 'fotogrids')}
                        value={attributes.galleryId}
                        options={galleryOptions}
                        onChange={(value) => handleGallerySelect(parseInt(value, 10))}
                    />
                    
                    <Button
                        isSecondary
                        onClick={() => setIsSelectingGallery(true)}
                    >
                        {__('Change Gallery', 'fotogrids')}
                    </Button>
                </PanelBody>

                <PanelBody title={__('Layout Settings', 'fotogrids')}>
                    <TemplateSelector
                        templates={templates}
                        selectedTemplate={attributes.template}
                        onTemplateChange={handleTemplateChange}
                    />

                    {attributes.template === 'grid' && (
                        <RangeControl
                            label={__('Columns', 'fotogrids')}
                            value={attributes.columns}
                            onChange={(columns) => setAttributes({ columns })}
                            min={1}
                            max={6}
                            step={1}
                        />
                    )}

                    {attributes.template === 'masonry' && (
                        <RangeControl
                            label={__('Columns', 'fotogrids')}
                            value={attributes.columns}
                            onChange={(columns) => setAttributes({ columns })}
                            min={2}
                            max={6}
                            step={1}
                        />
                    )}

                    {attributes.template === 'justified' && (
                        <SelectControl
                            label={__('Row Height', 'fotogrids')}
                            value={attributes.columns} // Reusing columns for row height
                            options={[
                                { label: __('Small', 'fotogrids'), value: 1 },
                                { label: __('Medium', 'fotogrids'), value: 2 },
                                { label: __('Large', 'fotogrids'), value: 3 },
                                { label: __('Extra Large', 'fotogrids'), value: 4 },
                            ]}
                            onChange={(value) => setAttributes({ columns: parseInt(value, 10) })}
                        />
                    )}
                </PanelBody>

                <PanelBody title={__('Display Settings', 'fotogrids')}>
                    <ToggleControl
                        label={__('Show Captions', 'fotogrids')}
                        help={__('Display image captions on hover.', 'fotogrids')}
                        checked={attributes.showCaptions}
                        onChange={(showCaptions) => setAttributes({ showCaptions })}
                    />

                    <ToggleControl
                        label={__('Enable Lightbox', 'fotogrids')}
                        help={__('Open images in lightbox when clicked.', 'fotogrids')}
                        checked={attributes.lightbox}
                        onChange={(lightbox) => setAttributes({ lightbox })}
                    />

                    <ToggleControl
                        label={__('Lazy Loading', 'fotogrids')}
                        help={__('Load images as they come into view for better performance.', 'fotogrids')}
                        checked={attributes.lazyLoad}
                        onChange={(lazyLoad) => setAttributes({ lazyLoad })}
                    />
                </PanelBody>

                <PanelBody title={__('Advanced', 'fotogrids')} initialOpen={false}>
                    <TextareaControl
                        label={__('Custom CSS', 'fotogrids')}
                        help={__('Add custom CSS styles for this gallery.', 'fotogrids')}
                        value={attributes.customCSS || ''}
                        onChange={(customCSS) => setAttributes({ customCSS })}
                        rows={6}
                    />
                </PanelBody>
            </InspectorControls>

            <div {...blockProps}>
                <GalleryPreview
                    gallery={selectedGallery}
                    template={selectedTemplate}
                    attributes={attributes}
                    isSelected={isSelected}
                />
            </div>
        </>
    );
};
