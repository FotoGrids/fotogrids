/**
 * VideoEmbedModal
 *
 * Add a YouTube or Vimeo video as a virtual gallery item.
 */

import React, { useState, useCallback, useRef } from 'react';
import Modal  from './shared/Modal.jsx';
import Icon   from './shared/Icon.jsx';
import Toggle from './shared/Toggle.jsx';

function extractYouTubeId( url ) {
    if ( ! url ) return null;
    const patterns = [
        /[?&]v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /\/embed\/([a-zA-Z0-9_-]{11})/,
        /\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for ( const re of patterns ) {
        const m = url.match( re );
        if ( m ) return m[1];
    }
    return null;
}

function extractVimeoId( url ) {
    if ( ! url ) return null;
    const m = url.match( /vimeo\.com\/(?:video\/)?(\d+)/ );
    return m ? m[1] : null;
}

const SOURCES = [
    { value: 'youtube', label: 'YouTube' },
    { value: 'vimeo',   label: 'Vimeo'   },
];

const TABS = {
    youtube: [
        { id: 'link',    label: 'Link'    },
        { id: 'options', label: 'Options' },
    ],
    vimeo: [
        { id: 'link',    label: 'Link'    },
        { id: 'options', label: 'Options' },
    ],
};

const SUGGESTED_VIDEOS_OPTIONS = [
    { value: 'channel', label: 'Current Video Channel' },
    { value: 'any',     label: 'Any Video'             },
    { value: 'none',    label: 'None'                  },
];

const DEFAULT_STATE = {
    source:            'youtube',
    url:               '',
    videoId:           null,
    thumbnailUrl:      null,
    title:             '',
    caption:           '',
    startTime:         '',
    endTime:           '',
    autoplay:          false,
    mute:              false,
    loop:              false,
    privacyMode:       false,
    showControls:      true,
    showCaptions:      false,
    suggestedVideos:   'channel',
    showIntroTitle:    true,
    showIntroPortrait: true,
    showIntroByline:   true,
    controlsColor:     '',
};

const VideoEmbedModal = ( { isOpen, onClose, onAdd, strings = {} } ) => {

    const [ form, setForm ]           = useState( { ...DEFAULT_STATE } );
    const [ urlDraft, setUrlDraft ]   = useState( '' );
    const [ activeTab, setActiveTab ] = useState( 'link' );
    const [ resolving, setResolving ] = useState( false );
    const [ resolveError, setResolveError ] = useState( '' );
    const [ adding, setAdding ]       = useState( false );

    const set = useCallback( ( key, value ) =>
        setForm( prev => ( { ...prev, [ key ]: value } ) ), [] );

    const resetForm = useCallback( () => {
        setForm( { ...DEFAULT_STATE } );
        setUrlDraft( '' );
        setResolveError( '' );
        setActiveTab( 'link' );
    }, [] );

    const handleClose = useCallback( () => {
        resetForm();
        onClose();
    }, [ onClose, resetForm ] );

    const handleSourceChange = useCallback( ( source ) => {
        setForm( { ...DEFAULT_STATE, source } );
        setUrlDraft( '' );
        setResolveError( '' );
        setActiveTab( 'link' );
    }, [] );

    const resolveUrl = useCallback( async ( rawUrl ) => {
        const url = rawUrl.trim();
        if ( ! url ) return;

        const isYT = form.source === 'youtube';
        const isValid = isYT ? !! extractYouTubeId( url ) : !! extractVimeoId( url );

        if ( ! isValid ) {
            setResolveError(
                isYT
                    ? ( strings.invalidYouTubeUrl || 'Please enter a valid YouTube URL.' )
                    : ( strings.invalidVimeoUrl   || 'Please enter a valid Vimeo URL.'   )
            );
            return;
        }

        setResolveError( '' );
        setResolving( true );

        try {
            const restBase  = window.wpApiSettings?.root  || '/wp-json/';
            const restNonce = window.wpApiSettings?.nonce || '';

            const res  = await fetch( `${ restBase }fotogrids/v1/items/resolve-embed`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': restNonce },
                body:    JSON.stringify( { platform: form.source, url } ),
            } );

            if ( ! res.ok ) throw new Error( `HTTP ${ res.status }` );
            const json = await res.json();

            if ( json.video_id ) {
                setForm( prev => ( { ...prev, url, videoId: json.video_id, thumbnailUrl: json.thumbnail_url || null, title: json.title || '' } ) );
            } else {
                throw new Error( json.message || 'Could not resolve video.' );
            }
        } catch ( err ) {
            // Graceful degradation: populate from URL alone
            const videoId = form.source === 'youtube'
                ? extractYouTubeId( url )
                : extractVimeoId( url );

            if ( videoId ) {
                const thumbUrl = form.source === 'youtube'
                    ? `https://img.youtube.com/vi/${ videoId }/hqdefault.jpg`
                    : null;
                setForm( prev => ( { ...prev, url, videoId, thumbnailUrl: thumbUrl, title: '' } ) );
                setResolveError( strings.resolveMetadataFailed || 'Video found but metadata could not be fetched.' );
            } else {
                setResolveError( err.message || ( strings.resolveError || 'Could not resolve video URL.' ) );
            }
        } finally {
            setResolving( false );
        }
    }, [ form.source, strings ] );

    const handleAdd = useCallback( async () => {
        if ( ! form.videoId ) return;
        setAdding( true );
        try {
            await onAdd( form );
            handleClose();
        } catch ( err ) {
            console.error( '[FotoGrids] VideoEmbedModal: onAdd failed', err );
        } finally {
            setAdding( false );
        }
    }, [ form, onAdd, handleClose ] );

    const hasVideo = !! form.videoId;

    const renderSidebar = () => (
        <>
            <div className="fotogrids-item-preview">
                { hasVideo && form.thumbnailUrl ? (
                    <img
                        src={ form.thumbnailUrl }
                        alt={ form.title || 'Video thumbnail' }
                    />
                ) : (
                    <div className="fotogrids-item-preview__skeleton" />
                ) }
            </div>

            <div className="fotogrids-file-info">
                <div className="fotogrids-file-info__item">
                    <span className="fotogrids-file-info__label">
                        { strings.source || 'Source' }:
                    </span>
                    <span className="fotogrids-file-info__value">
                        { form.source === 'youtube' ? 'YouTube' : 'Vimeo' }
                    </span>
                </div>
                { hasVideo && (
                    <div className="fotogrids-file-info__item fotogrids-file-info__item--animate">
                        <span className="fotogrids-file-info__label">
                            { strings.videoId || 'Video ID' }:
                        </span>
                        <span className="fotogrids-file-info__value">
                            { form.videoId }
                        </span>
                    </div>
                ) }
                { hasVideo && form.title && (
                    <div className="fotogrids-file-info__item fotogrids-file-info__item--animate">
                        <span className="fotogrids-file-info__label">
                            { strings.title || 'Title' }:
                        </span>
                        <span className="fotogrids-file-info__value">
                            { form.title }
                        </span>
                    </div>
                ) }
            </div>
        </>
    );

    const renderLinkTab = () => (
        <div className="fotogrids-tab-panel fg-is-active">
            <div className="fotogrids-form-fields">

                <div className="fotogrids-form-field">
                    <label>{ strings.source || 'Source' }</label>
                    <div className="fotogrids-button-group__buttons">
                        { SOURCES.map( src => (
                            <button
                                key={ src.value }
                                type="button"
                                className={ `fotogrids-button-group__button ${ form.source === src.value ? 'fg-is-active' : '' }` }
                                onClick={ () => handleSourceChange( src.value ) }
                            >
                                <span className="fotogrids-button-label">{ src.label }</span>
                            </button>
                        ) ) }
                    </div>
                </div>

                <div className="fotogrids-form-field">
                    <label htmlFor="fg-embed-url">
                        { strings.link || 'Link' }
                    </label>
                    <div className="fotogrids-embed-url-row">
                        <input
                            id="fg-embed-url"
                            type="text"
                            inputMode="url"
                            value={ urlDraft }
                            onChange={ e => {
                                setUrlDraft( e.target.value );
                                if ( form.videoId ) {
                                    setForm( prev => ( { ...prev, videoId: null, thumbnailUrl: null, title: '' } ) );
                                }
                                setResolveError( '' );
                            } }
                            onKeyDown={ e => { if ( e.key === 'Enter' ) { e.preventDefault(); resolveUrl( urlDraft ); } } }
                            onBlur={ () => { if ( urlDraft && ! form.videoId ) resolveUrl( urlDraft ); } }
                            placeholder={
                                form.source === 'youtube'
                                    ? 'https://www.youtube.com/watch?v=...'
                                    : 'https://vimeo.com/...'
                            }
                            pattern={
                                form.source === 'youtube'
                                    ? 'https?://(www\\.)?(youtube\\.com/(watch\\?.*v=|embed/|shorts/)|youtu\\.be/)[a-zA-Z0-9_-]{11}.*'
                                    : 'https?://(www\\.)?vimeo\\.com/(video/)?[0-9]+'
                            }
                            className={ `fotogrids-embed-url-input ${ resolveError ? 'fotogrids-embed-url-input--error' : '' } ${ hasVideo ? 'fotogrids-embed-url-input--ok' : '' }` }
                            disabled={ resolving }
                            autoComplete="off"
                            spellCheck={ false }
                        />
                        <button
                            type="button"
                            className="fotogrids-button fotogrids-button--secondary fotogrids-embed-resolve-btn"
                            onClick={ () => resolveUrl( urlDraft ) }
                            disabled={ resolving || ! urlDraft }
                            title={ strings.loadVideo || 'Load video' }
                        >
                            { resolving
                                ? <span className="fotogrids-embed-spinner" />
                                : <Icon name="link" />
                            }
                        </button>
                    </div>
                    { resolveError && (
                        <p className="description fotogrids-text--error" style={ { marginTop: 4 } }>
                            { resolveError }
                        </p>
                    ) }
                    { hasVideo && ! resolveError && (
                        <p className="description" style={ { marginTop: 4, color: '#2e7d32' } }>
                            { strings.videoLoaded || 'Video loaded successfully.' }
                        </p>
                    ) }
                </div>

                <div className="fotogrids-form-field">
                    <label htmlFor="fg-embed-start">
                        { strings.startTime || 'Start Time' }
                    </label>
                    <input
                        id="fg-embed-start"
                        type="number"
                        min="0"
                        value={ form.startTime }
                        onChange={ e => set( 'startTime', e.target.value ) }
                        placeholder="-"
                        className="fotogrids-embed-time-input"
                    />
                    <p className="description">{ strings.startTimeDesc || 'Specify a start time (in seconds)' }</p>
                </div>

                {/* End time - YouTube only */}
                { form.source === 'youtube' && (
                    <div className="fotogrids-form-field">
                        <label htmlFor="fg-embed-end">
                            { strings.endTime || 'End Time' }
                        </label>
                        <input
                            id="fg-embed-end"
                            type="number"
                            min="0"
                            value={ form.endTime }
                            onChange={ e => set( 'endTime', e.target.value ) }
                            placeholder="-"
                            className="fotogrids-embed-time-input"
                        />
                        <p className="description">{ strings.endTimeDesc || 'Specify an end time (in seconds)' }</p>
                    </div>
                ) }

                <div className="fotogrids-form-field">
                    <label htmlFor="fg-embed-caption">
                        { strings.caption || 'Caption' }
                    </label>
                    <textarea
                        id="fg-embed-caption"
                        rows="3"
                        value={ form.caption }
                        onChange={ e => set( 'caption', e.target.value ) }
                        placeholder={ form.title || '' }
                    />
                </div>

            </div>
        </div>
    );

    const renderYouTubeOptions = () => (
        <div className="fotogrids-tab-panel fg-is-active">
            <div className="fotogrids-form-fields">

                <div className="fotogrids-form-field">
                    <Toggle
                        id="fg-embed-autoplay"
                        label={ strings.autoplay || 'Autoplay' }
                        description={ strings.autoplayNote || 'Autoplay is subject to browser autoplay policies.' }
                        checked={ form.autoplay }
                        onChange={ v => set( 'autoplay', v ) }
                    />
                </div>

                <div className="fotogrids-form-field">
                    <Toggle
                        id="fg-embed-mute"
                        label={ strings.mute || 'Mute' }
                        checked={ form.mute }
                        onChange={ v => set( 'mute', v ) }
                    />
                </div>

                <div className="fotogrids-form-field">
                    <Toggle
                        id="fg-embed-loop"
                        label={ strings.loop || 'Loop' }
                        checked={ form.loop }
                        onChange={ v => set( 'loop', v ) }
                    />
                </div>

                <div className="fotogrids-form-field">
                    <Toggle
                        id="fg-embed-controls"
                        label={ strings.playerControls || 'Player Controls' }
                        checked={ form.showControls }
                        onChange={ v => set( 'showControls', v ) }
                    />
                </div>

                <div className="fotogrids-form-field">
                    <Toggle
                        id="fg-embed-captions"
                        label={ strings.captions || 'Captions' }
                        checked={ form.showCaptions }
                        onChange={ v => set( 'showCaptions', v ) }
                    />
                </div>

                <div className="fotogrids-form-field">
                    <Toggle
                        id="fg-embed-privacy"
                        label={ strings.privacyMode || 'Privacy Mode' }
                        description={ strings.privacyModeNote || "When on, YouTube won't store information about visitors unless they play the video." }
                        checked={ form.privacyMode }
                        onChange={ v => set( 'privacyMode', v ) }
                    />
                </div>

                <div className="fotogrids-form-field">
                    <label htmlFor="fg-embed-suggested">
                        { strings.suggestedVideos || 'Suggested Videos' }
                    </label>
                    <select
                        id="fg-embed-suggested"
                        value={ form.suggestedVideos }
                        onChange={ e => set( 'suggestedVideos', e.target.value ) }
                    >
                        { SUGGESTED_VIDEOS_OPTIONS.map( opt => (
                            <option key={ opt.value } value={ opt.value }>{ opt.label }</option>
                        ) ) }
                    </select>
                </div>

            </div>
        </div>
    );

    const renderVimeoOptions = () => (
        <div className="fotogrids-tab-panel fg-is-active">
            <div className="fotogrids-form-fields">

                <div className="fotogrids-form-field">
                    <Toggle
                        id="fg-embed-autoplay"
                        label={ strings.autoplay || 'Autoplay' }
                        description={ strings.autoplayNote || 'Autoplay is subject to browser autoplay policies.' }
                        checked={ form.autoplay }
                        onChange={ v => set( 'autoplay', v ) }
                    />
                </div>

                <div className="fotogrids-form-field">
                    <Toggle
                        id="fg-embed-mute"
                        label={ strings.mute || 'Mute' }
                        checked={ form.mute }
                        onChange={ v => set( 'mute', v ) }
                    />
                </div>

                <div className="fotogrids-form-field">
                    <Toggle
                        id="fg-embed-loop"
                        label={ strings.loop || 'Loop' }
                        checked={ form.loop }
                        onChange={ v => set( 'loop', v ) }
                    />
                </div>

                <div className="fotogrids-form-field">
                    <Toggle
                        id="fg-embed-privacy"
                        label={ strings.privacyMode || 'Privacy Mode' }
                        description={ strings.privacyModeNote || "When on, Vimeo won't store information about visitors unless they play the video." }
                        checked={ form.privacyMode }
                        onChange={ v => set( 'privacyMode', v ) }
                    />
                </div>

                <div className="fotogrids-form-field">
                    <Toggle
                        id="fg-embed-intro-title"
                        label={ strings.introTitle || 'Intro Title' }
                        checked={ form.showIntroTitle }
                        onChange={ v => set( 'showIntroTitle', v ) }
                    />
                </div>

                <div className="fotogrids-form-field">
                    <Toggle
                        id="fg-embed-intro-portrait"
                        label={ strings.introPortrait || 'Intro Portrait' }
                        checked={ form.showIntroPortrait }
                        onChange={ v => set( 'showIntroPortrait', v ) }
                    />
                </div>

                <div className="fotogrids-form-field">
                    <Toggle
                        id="fg-embed-intro-byline"
                        label={ strings.introByline || 'Intro Byline' }
                        checked={ form.showIntroByline }
                        onChange={ v => set( 'showIntroByline', v ) }
                    />
                </div>

                <div className="fotogrids-form-field">
                    <label htmlFor="fg-embed-color">
                        { strings.controlsColor || 'Controls Color' }
                    </label>
                    <input
                        id="fg-embed-color"
                        type="color"
                        value={ form.controlsColor || '#000000' }
                        onChange={ e => set( 'controlsColor', e.target.value ) }
                        className="fotogrids-embed-color-input"
                    />
                </div>

            </div>
        </div>
    );

    const tabs = TABS[ form.source ];

    const renderBody = () => (
        <>
            <div className="fotogrids-modal-tabs">
                { tabs.map( tab => (
                    <button
                        key={ tab.id }
                        type="button"
                        className={ `fotogrids-tab-button ${ activeTab === tab.id ? 'fg-is-active' : '' }` }
                        onClick={ () => setActiveTab( tab.id ) }
                    >
                        { tab.label }
                    </button>
                ) ) }
            </div>

            <div className="fotogrids-tab-content">
                { activeTab === 'link' && renderLinkTab() }
                { activeTab === 'options' && (
                    form.source === 'youtube' ? renderYouTubeOptions() : renderVimeoOptions()
                ) }
            </div>
        </>
    );

    const renderFooter = () => (
        <>
            <button
                type="button"
                className="button fotogrids-modal-cancel"
                onClick={ handleClose }
                disabled={ adding }
            >
                { strings.cancel || 'Cancel' }
            </button>
            <button
                type="button"
                className="button button-primary"
                onClick={ handleAdd }
                disabled={ ! hasVideo || adding }
            >
                { adding
                    ? ( strings.adding     || 'Adding…'        )
                    : ( strings.addToGallery || 'Add to Gallery' )
                }
            </button>
        </>
    );

    return (
        <Modal
            isOpen={ isOpen }
            onClose={ handleClose }
            title={ strings.addVideoEmbed || 'Add Video Embed' }
            size="medium"
            sidebar={ renderSidebar() }
            footer={ renderFooter() }
            closeOnOverlayClick={ false }
        >
            { renderBody() }
        </Modal>
    );
};

export default VideoEmbedModal;
