/**
 * Gallery Preview Component
 * 
 * Live preview of gallery in Gutenberg block editor
 */

import React, { useState, useEffect } from 'react';
import { 
    Placeholder,
    Spinner,
    Notice,
    Button 
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { gallery } from '@wordpress/icons';
import apiFetch from '@wordpress/api-fetch';
import { GalleryBlockAttributes } from '../blocks/gallery-block';

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

interface Image {
    id: number;
    url: string;
    thumbnail: string;
    medium: string;
    large: string;
    full: string;
    alt: string;
    title: string;
    caption: string;
}

interface GalleryPreviewProps {
    gallery: Gallery | undefined;
    template: Template | undefined;
    attributes: GalleryBlockAttributes;
    isSelected: boolean;
}

export const GalleryPreview: React.FC<GalleryPreviewProps> = ({
    gallery,
    template,
    attributes,
    isSelected,
}) => {
    const [images, setImages] = useState<Image[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load gallery images
    useEffect(() => {
        if (gallery) {
            loadGalleryImages();
        }
    }, [gallery?.id]);

    const loadGalleryImages = async () => {
        if (!gallery) return;

        try {
            setIsLoading(true);
            setError(null);
            const response = await apiFetch({
                path: `/fotogrids/v1/galleries/${gallery.id}/images`,
            }) as Image[];
            setImages(response.slice(0, 12)); // Limit preview to 12 images
        } catch (err) {
            setError(__('Failed to load gallery images.', 'fotogrids'));
            console.error('Failed to load gallery images:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <Placeholder
                icon={gallery}
                label={__('Loading Gallery Preview', 'fotogrids')}
            >
                <Spinner />
            </Placeholder>
        );
    }

    // Error state
    if (error) {
        return (
            <Notice status="error" isDismissible={false}>
                {error}
                <Button isSecondary onClick={loadGalleryImages}>
                    {__('Retry', 'fotogrids')}
                </Button>
            </Notice>
        );
    }

    // No images state
    if (!gallery || images.length === 0) {
        return (
            <Placeholder
                icon={gallery}
                label={gallery?.title || __('Gallery Preview', 'fotogrids')}
                instructions={__('This gallery has no images yet.', 'fotogrids')}
            >
                <Button
                    isPrimary
                    onClick={() => {
                        window.open(`/wp-admin/admin.php?page=fotogrids&action=edit&id=${gallery?.id}`, '_blank');
                    }}
                >
                    {__('Add Images', 'fotogrids')}
                </Button>
            </Placeholder>
        );
    }

    // Generate preview classes
    const previewClasses = [
        'fotogrids-gallery-preview',
        `fotogrids-layout-${attributes.template}`,
        attributes.showCaptions ? 'fotogrids-show-captions' : '',
        isSelected ? 'is-selected' : '',
    ].filter(Boolean).join(' ');

    // Render gallery preview based on template
    const renderGalleryPreview = () => {
        switch (attributes.template) {
            case 'grid':
                return renderGridPreview();
            case 'masonry':
                return renderMasonryPreview();
            case 'justified':
                return renderJustifiedPreview();
            default:
                return renderGridPreview();
        }
    };

    const renderGridPreview = () => (
        <div 
            className={previewClasses}
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(attributes.columns, 4)}, 1fr)`,
                gap: '8px',
            }}
        >
            {images.map(renderImageItem)}
        </div>
    );

    const renderMasonryPreview = () => (
        <div 
            className={previewClasses}
            style={{
                columnCount: Math.min(attributes.columns, 3),
                columnGap: '8px',
            }}
        >
            {images.map(renderImageItem)}
        </div>
    );

    const renderJustifiedPreview = () => (
        <div 
            className={previewClasses}
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
            }}
        >
            {images.map((image, index) => (
                <div
                    key={image.id}
                    style={{
                        flexGrow: 1,
                        height: '120px',
                        minWidth: '80px',
                    }}
                >
                    {renderImageItem(image, index)}
                </div>
            ))}
        </div>
    );

    const renderImageItem = (image: Image, index?: number) => (
        <div
            key={image.id}
            className="fotogrids-preview-item"
            style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '4px',
                backgroundColor: '#f0f0f0',
                marginBottom: attributes.template === 'masonry' ? '8px' : '0',
                breakInside: 'avoid',
            }}
        >
            <img
                src={image.medium || image.thumbnail}
                alt={image.alt || image.title}
                style={{
                    width: '100%',
                    height: attributes.template === 'grid' ? '100%' : 'auto',
                    objectFit: attributes.template === 'grid' ? 'cover' : 'contain',
                    display: 'block',
                }}
                loading="lazy"
            />
            {attributes.showCaptions && image.caption && (
                <div
                    className="fotogrids-preview-caption"
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                        color: 'white',
                        padding: '16px 8px 8px',
                        fontSize: '11px',
                        lineHeight: 1.3,
                        opacity: 0.8,
                    }}
                >
                    {image.caption}
                </div>
            )}
        </div>
    );

    return (
        <div className="fotogrids-block-preview">
            {/* Gallery Header */}
            <div style={{
                marginBottom: '12px',
                padding: '8px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#666',
            }}>
                <strong>{gallery.title}</strong>
                {template && (
                    <span style={{ marginLeft: '8px' }}>
                        • {template.name}
                    </span>
                )}
                <span style={{ marginLeft: '8px' }}>
                    • {images.length} {__('images', 'fotogrids')}
                    {gallery.image_count > images.length && (
                        <span> ({__('showing first', 'fotogrids')} {images.length})</span>
                    )}
                </span>
            </div>

            {/* Gallery Preview */}
            {renderGalleryPreview()}

            {/* Custom CSS Preview */}
            {attributes.customCSS && (
                <style>
                    {attributes.customCSS}
                </style>
            )}

            {/* Editor Overlay */}
            {isSelected && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        border: '2px solid #0073aa',
                        borderRadius: '4px',
                        pointerEvents: 'none',
                    }}
                />
            )}

            <style jsx>{`
                .fotogrids-block-preview {
                    position: relative;
                    max-width: 100%;
                }

                .fotogrids-gallery-preview {
                    max-height: 400px;
                    overflow: hidden;
                    position: relative;
                }

                .fotogrids-preview-item {
                    transition: transform 0.2s ease;
                }

                .fotogrids-preview-item:hover {
                    transform: scale(1.02);
                }

                .fotogrids-gallery-preview.is-selected::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 115, 170, 0.1);
                    pointer-events: none;
                }
            `}</style>
        </div>
    );
};
