/**
 * Gallery Block Save Component
 * 
 * Renders the saved content for FotoGrids Gallery block
 */

import React from 'react';
import { BlockSaveProps } from '@wordpress/blocks';
import { useBlockProps } from '@wordpress/block-editor';
import { GalleryBlockAttributes } from '../blocks/gallery-block';

export const GalleryBlockSave: React.FC<BlockSaveProps<GalleryBlockAttributes>> = ({
    attributes,
}) => {
    const blockProps = useBlockProps.save({
        className: `fotogrids-block-gallery align${attributes.align || 'none'}`,
    });

    // Generate shortcode attributes
    const shortcodeAttrs = [
        `id="${attributes.galleryId}"`,
        `template="${attributes.template}"`,
        `cols="${attributes.columns}"`,
        `captions="${attributes.showCaptions ? 'true' : 'false'}"`,
        `lightbox="${attributes.lightbox ? 'true' : 'false'}"`,
        `lazy="${attributes.lazyLoad ? 'true' : 'false'}"`,
    ].join(' ');

    const shortcode = `[fotogrids_gallery ${shortcodeAttrs}]`;

    return (
        <div {...blockProps}>
            {/* Custom CSS if provided */}
            {attributes.customCSS && (
                <style>
                    {attributes.customCSS}
                </style>
            )}
            
            {/* 
                The shortcode will be processed by WordPress and replaced 
                with the actual gallery HTML on the frontend 
            */}
            <div 
                className="fotogrids-shortcode-wrapper"
                data-shortcode={shortcode}
            >
                {shortcode}
            </div>
        </div>
    );
};
