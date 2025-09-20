import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import GalleryBlockEdit from '../components/blocks/GalleryBlockEdit-simple';
import GalleryBlockSave from '../components/blocks/GalleryBlockSave-simple';

registerBlockType('fotogrids/gallery', {
    title: __('FotoGrids Gallery', 'fotogrids'),
    icon: 'format-gallery',
    category: 'media',
    attributes: {
        galleryId: {
            type: 'number',
            default: 0,
        },
        template: {
            type: 'string',
            default: 'grid',
        },
        cols: {
            type: 'number',
            default: 3,
        },
        captions: {
            type: 'boolean',
            default: true,
        },
        lightbox: {
            type: 'boolean',
            default: true,
        },
        lazy: {
            type: 'boolean',
            default: true,
        },
    },
    edit: GalleryBlockEdit,
    save: GalleryBlockSave,
});
