import React from 'react';
import { BlockSaveProps } from '@wordpress/blocks';

interface GalleryBlockAttributes {
    galleryId: number;
    template: string;
    cols: number;
    captions: boolean;
    lightbox: boolean;
    lazy: boolean;
}

const GalleryBlockSave: React.FC<BlockSaveProps<GalleryBlockAttributes>> = ({ attributes }) => {
    const { galleryId, template, cols, captions, lightbox, lazy } = attributes;
    
    const blockProps = {};

    return (
        <div {...blockProps}>
            {/* This will be rendered by PHP on the frontend */}
            {`[fotogrids_gallery id="${galleryId}" template="${template}" cols="${cols}" captions="${captions ? 'true' : 'false'}" lightbox="${lightbox ? 'true' : 'false'}" lazy="${lazy ? 'true' : 'false'}"]`}
        </div>
    );
};

export default GalleryBlockSave;
