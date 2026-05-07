/**
 * Gallery Selector Component
 *
 * Interface for selecting a gallery in Gutenberg block
 */

import React from 'react';
import {
    Placeholder,
    Button,
    Card,
    CardBody,
    CardMedia,
    CardHeader
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { gallery, plus } from '@wordpress/icons';

interface Gallery {
    id: number;
    title: string;
    item_count: number;
    featured_item?: string;
}

interface GallerySelectorProps {
    galleries: Gallery[];
    selectedGalleryId: number;
    onGallerySelect: (galleryId: number) => void;
    onCreateNew: () => void;
}

export const GallerySelector: React.FC<GallerySelectorProps> = ({
    galleries,
    selectedGalleryId,
    onGallerySelect,
    onCreateNew,
}) => {
    if (galleries.length === 0) {
        return (
            <Placeholder
                icon={gallery}
                label={__('FotoGrids Gallery', 'fotogrids')}
                instructions={__('No galleries found. Create your first gallery to get started.', 'fotogrids')}
            >
                <Button variant="primary" onClick={onCreateNew}>
                    {__('Create New Gallery', 'fotogrids')}
                </Button>
            </Placeholder>
        );
    }

    return (
        <Placeholder
            icon={gallery}
            label={__('FotoGrids Gallery', 'fotogrids')}
            instructions={__('Select a gallery to display, or create a new one.', 'fotogrids')}
            className="fotogrids-gallery-selector"
        >
            <div className="fotogrids-gallery-grid">
                {galleries.map((galleryItem) => (
                    <Card
                        key={galleryItem.id}
                        className={`fotogrids-gallery-card ${
                            selectedGalleryId === galleryItem.id ? 'is-selected' : ''
                        }`}
                        onClick={() => onGallerySelect(galleryItem.id)}
                        style={{ cursor: 'pointer' }}
                    >
                        {galleryItem.featured_item && (
                            <CardMedia>
                                <img
                                    src={galleryItem.featured_item}
                                    alt={galleryItem.title}
                                    style={{
                                        width: '100%',
                                        height: '120px',
                                        objectFit: 'cover',
                                    }}
                                />
                            </CardMedia>
                        )}
                        <CardHeader>
                            <h3 style={{
                                margin: 0,
                                fontSize: '14px',
                                fontWeight: 600,
                                textAlign: 'center'
                            }}>
                                {galleryItem.title}
                            </h3>
                        </CardHeader>
                        <CardBody>
                            <p style={{
                                margin: 0,
                                fontSize: '12px',
                                color: '#666',
                                textAlign: 'center'
                            }}>
                                {galleryItem.item_count} {__('items', 'fotogrids')}
                            </p>
                        </CardBody>
                    </Card>
                ))}

                {/* Create New Gallery Card */}
                <Card
                    className="fotogrids-gallery-card fotogrids-create-new"
                    onClick={onCreateNew}
                    style={{ cursor: 'pointer' }}
                >
                    <CardBody style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '180px',
                        border: '2px dashed #ccc',
                        borderRadius: '4px'
                    }}>
                        <div style={{
                            fontSize: '24px',
                            color: '#666',
                            marginBottom: '8px'
                        }}>
                            {plus}
                        </div>
                        <p style={{
                            margin: 0,
                            fontSize: '14px',
                            color: '#666',
                            textAlign: 'center'
                        }}>
                            {__('Create New Gallery', 'fotogrids')}
                        </p>
                    </CardBody>
                </Card>
            </div>

            <div style={{ marginTop: '16px' }}>
                <Button variant="primary" onClick={onCreateNew}>
                    {__('Create New Gallery', 'fotogrids')}
                </Button>
            </div>
        </Placeholder>
    );
};
