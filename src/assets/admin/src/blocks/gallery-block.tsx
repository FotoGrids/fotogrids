/**
 * FotoGrids Gallery Block
 * 
 * Gutenberg block for inserting FotoGrids galleries with live preview
 */

import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { gallery } from '@wordpress/icons';
import { GalleryBlockEdit } from '../components/blocks/GalleryBlockEdit';
import { GalleryBlockSave } from '../components/blocks/GalleryBlockSave';

// Block attributes interface
export interface GalleryBlockAttributes {
    galleryId: number;
    template: string;
    columns: number;
    showCaptions: boolean;
    lightbox: boolean;
    lazyLoad: boolean;
    customCSS?: string;
    align?: string;
}

// Default attributes
const defaultAttributes: GalleryBlockAttributes = {
    galleryId: 0,
    template: 'grid',
    columns: 3,
    showCaptions: true,
    lightbox: true,
    lazyLoad: true,
    align: 'none'
};

/**
 * Register the FotoGrids Gallery block
 */
registerBlockType('fotogrids/gallery', {
    apiVersion: 2,
    title: __('FotoGrids Gallery', 'fotogrids'),
    description: __('Display a FotoGrids gallery with customizable layouts and settings.', 'fotogrids'),
    category: 'media',
    icon: gallery,
    keywords: [
        __('gallery', 'fotogrids'),
        __('photos', 'fotogrids'),
        __('images', 'fotogrids'),
        __('fotogrids', 'fotogrids'),
    ],
    supports: {
        align: ['left', 'center', 'right', 'wide', 'full'],
        html: false,
        multiple: true,
        reusable: true,
        spacing: {
            margin: true,
            padding: true,
        },
        typography: {
            fontSize: true,
            lineHeight: true,
        },
        color: {
            background: true,
            text: true,
            link: true,
        },
    },
    attributes: {
        galleryId: {
            type: 'number',
            default: defaultAttributes.galleryId,
        },
        template: {
            type: 'string',
            default: defaultAttributes.template,
        },
        columns: {
            type: 'number',
            default: defaultAttributes.columns,
        },
        showCaptions: {
            type: 'boolean',
            default: defaultAttributes.showCaptions,
        },
        lightbox: {
            type: 'boolean',
            default: defaultAttributes.lightbox,
        },
        lazyLoad: {
            type: 'boolean',
            default: defaultAttributes.lazyLoad,
        },
        customCSS: {
            type: 'string',
            default: '',
        },
        align: {
            type: 'string',
            default: defaultAttributes.align,
        },
    },
    example: {
        attributes: {
            galleryId: 1,
            template: 'grid',
            columns: 3,
            showCaptions: true,
            lightbox: true,
        },
    },
    edit: GalleryBlockEdit,
    save: GalleryBlockSave,
    transforms: {
        from: [
            {
                type: 'shortcode',
                tag: 'fotogrids_gallery',
                attributes: {
                    galleryId: {
                        type: 'number',
                        shortcode: ({ named: { id } }) => {
                            return parseInt(id, 10) || 0;
                        },
                    },
                    template: {
                        type: 'string',
                        shortcode: ({ named: { template } }) => {
                            return template || 'grid';
                        },
                    },
                    columns: {
                        type: 'number',
                        shortcode: ({ named: { cols } }) => {
                            return parseInt(cols, 10) || 3;
                        },
                    },
                    showCaptions: {
                        type: 'boolean',
                        shortcode: ({ named: { captions } }) => {
                            return captions !== 'false';
                        },
                    },
                    lightbox: {
                        type: 'boolean',
                        shortcode: ({ named: { lightbox } }) => {
                            return lightbox !== 'false';
                        },
                    },
                    lazyLoad: {
                        type: 'boolean',
                        shortcode: ({ named: { lazy } }) => {
                            return lazy !== 'false';
                        },
                    },
                },
            },
        ],
        to: [
            {
                type: 'shortcode',
                tag: 'fotogrids_gallery',
                attributes: {
                    id: 'galleryId',
                    template: 'template',
                    cols: 'columns',
                    captions: 'showCaptions',
                    lightbox: 'lightbox',
                    lazy: 'lazyLoad',
                },
            },
        ],
    },
});

export { defaultAttributes };
