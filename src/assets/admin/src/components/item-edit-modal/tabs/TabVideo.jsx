import React from 'react';
import Toggle from '../../shared/Toggle.jsx';
import { Button } from '../../shared/Button';

/**
 * Video tab for Media Library video items. Edits the poster image and basic
 * playback options, all stored in the item's custom_data.
 */
const TabVideo = ({ itemData, videoSettings, onChange, disabled = false, strings = {} }) => {
    const posterUrl = videoSettings.poster_preview
        || itemData?.poster_url
        || '';

    const choosePoster = () => {
        if (!window.wp || !window.wp.media) {
            return;
        }
        const frame = window.wp.media({
            title: strings.choosePoster || 'Choose Poster Image',
            library: { type: 'image' },
            button: { text: strings.usePoster || 'Use as poster' },
            multiple: false,
        });
        frame.on('select', () => {
            const attachment = frame.state().get('selection').first().toJSON();
            onChange({
                ...videoSettings,
                poster_id: attachment.id,
                poster_url: attachment.url,
                poster_preview: (attachment.sizes && attachment.sizes.medium)
                    ? attachment.sizes.medium.url
                    : attachment.url,
            });
        });
        frame.open();
    };

    const clearPoster = () => {
        const next = { ...videoSettings };
        next.poster_id = 0;
        next.poster_url = '';
        next.poster_preview = '';
        onChange(next);
    };

    const setBool = (key, value) => {
        onChange({ ...videoSettings, [key]: value });
    };

    return (
        <div className="fotogrids-tab-panel fg-is-active">
            <div className="fotogrids-video-section">
                <div className="fotogrids-field-group">
                    <label>{strings.posterImage || 'Poster Image'}</label>
                    <div className="fotogrids-video-poster-row">
                        <div className="fotogrids-video-poster-preview">
                            {posterUrl ? (
                                <img src={posterUrl} alt={strings.posterImage || 'Poster'} />
                            ) : (
                                <div className="fotogrids-video-poster-preview__empty" />
                            )}
                        </div>
                        <div className="fotogrids-video-poster-actions">
                            <Button variant="secondary" onClick={choosePoster} disabled={disabled}>
                                {strings.choosePoster || 'Choose Poster'}
                            </Button>
                            {(videoSettings.poster_id || videoSettings.poster_url) ? (
                                <Button variant="tertiary" onClick={clearPoster} disabled={disabled}>
                                    {strings.removePoster || 'Remove'}
                                </Button>
                            ) : null}
                        </div>
                    </div>
                    <p className="description">
                        {strings.posterImageDesc
                            || 'Shown in the gallery before the video plays. Defaults to the video’s own thumbnail.'}
                    </p>
                </div>

                <div className="fotogrids-field-group">
                    <Toggle
                        id="fotogrids-video-autoplay"
                        label={strings.autoplay || 'Autoplay'}
                        description={strings.autoplayNote || 'Autoplay is subject to browser autoplay policies.'}
                        checked={!!videoSettings.autoplay}
                        onChange={(v) => setBool('autoplay', v)}
                        disabled={disabled}
                    />
                </div>

                <div className="fotogrids-field-group">
                    <Toggle
                        id="fotogrids-video-mute"
                        label={strings.mute || 'Mute'}
                        checked={!!videoSettings.mute}
                        onChange={(v) => setBool('mute', v)}
                        disabled={disabled}
                    />
                </div>

                <div className="fotogrids-field-group">
                    <Toggle
                        id="fotogrids-video-loop"
                        label={strings.loop || 'Loop'}
                        checked={!!videoSettings.loop}
                        onChange={(v) => setBool('loop', v)}
                        disabled={disabled}
                    />
                </div>

                <div className="fotogrids-field-group">
                    <Toggle
                        id="fotogrids-video-controls"
                        label={strings.playerControls || 'Player Controls'}
                        checked={videoSettings.controls === undefined ? true : !!videoSettings.controls}
                        onChange={(v) => setBool('controls', v)}
                        disabled={disabled}
                    />
                </div>
            </div>
        </div>
    );
};

export default TabVideo;
