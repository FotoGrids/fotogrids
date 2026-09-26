/**
 * The "no items yet" state of the gallery metabox.
 */

import React from 'react';
import Icon from '../../shared/Icon.jsx';
import MediaUpload from '../../blocks/MediaUpload.jsx';

/**
 * Renders the four ways to get the first items into an empty gallery.
 *
 * @param {Object}   props
 * @param {Object}   props.strings          Localised strings.
 * @param {Function} props.onUploadComplete Receives attachment ids after a direct upload.
 * @param {Function} props.onFromLibrary    Opens the media library.
 * @param {Function} props.onVideoEmbed     Opens the video embed modal.
 * @return {JSX.Element}
 */
const ItemsEmptyState = ({ strings, onUploadComplete, onFromLibrary, onVideoEmbed }) => {
    const handleOtherSources = () => window.FotoGridsUpgrade?.launchForFeature?.integrations?.();

    return (
        <>
            <p className="description">
                {strings.noItems}
            </p>
            <div className="fotogrids-items-noitems-add fotogrids-noitems-add-grid">
                <div className="fotogrids-noitems-add-block fotogrids-noitems-add-block--upload">
                    <MediaUpload onUploadComplete={onUploadComplete} inputId="fotogrids-metabox-upload-input" />
                </div>
                <button
                    type="button"
                    className="fotogrids-noitems-add-block fotogrids-noitems-add-block--action"
                    onClick={onFromLibrary}
                >
                    <Icon name="folder" className="fotogrids-noitems-add-block__icon" />
                    <h4>{strings.addFromLibrary}</h4>
                    <p>{strings.fromLibraryDescription}</p>
                </button>
                <button
                    type="button"
                    className="fotogrids-noitems-add-block fotogrids-noitems-add-block--action"
                    onClick={onVideoEmbed}
                >
                    <div
                        className="fotogrids-noitems-add-block__icon"
                        dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.video }}
                    />
                    <h4>{strings.addVideoEmbed}</h4>
                    <p>{strings.addVideoEmbedDescription}</p>
                </button>
                <button
                    type="button"
                    className="fotogrids-noitems-add-block fotogrids-noitems-add-block--action"
                    onClick={handleOtherSources}
                >
                    <div
                        className="fotogrids-noitems-add-block__icon"
                        dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.puzzle }}
                    />
                    <h4>{strings.fromOtherSources}</h4>
                    <p>{strings.fromOtherSourcesDescription}</p>
                </button>
            </div>
        </>
    );
};

export default ItemsEmptyState;
