/**
 * Block Registration Helper
 */
import React from 'react';

const { __ } = wp.i18n;

/**
 * Register FotoGrids Gutenberg blocks
 */
export const registerFotoGridsBlocks = () => {
    if (typeof wp === 'undefined' || !wp.blocks) {
        return;
    }

    const { registerBlockType } = wp.blocks;
    
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
            }
        },
        edit: function(props) {
            const { attributes, setAttributes } = props;
            const { galleryId, template, cols } = attributes;
            
            return React.createElement('div', { className: 'fotogrids-block-placeholder' }, [
                React.createElement('h3', { key: 'title' }, __('FotoGrids Gallery', 'fotogrids')),
                React.createElement('p', { key: 'desc' }, __('Gallery block is ready. Configure in the block settings.', 'fotogrids')),
                React.createElement('p', { key: 'settings' }, [
                    __('Gallery ID: ', 'fotogrids') + galleryId,
                    React.createElement('br', { key: 'br1' }),
                    __('Template: ', 'fotogrids') + template,
                    React.createElement('br', { key: 'br2' }),
                    __('Columns: ', 'fotogrids') + cols
                ])
            ]);
        },
        save: function(props) {
            const { attributes } = props;
            const { galleryId, template, cols } = attributes;
            
            return React.createElement('div', {}, 
                `[fotogrids_gallery id="${galleryId}" template="${template}" cols="${cols}"]`
            );
        },
    });
};

