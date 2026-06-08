/**
 * VideoEmbedModal
 *
 * Add a YouTube or Vimeo video as a virtual gallery item.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Modal } from './shared/Modal';
import { Button } from './shared/Button';
import Icon        from './shared/Icon.jsx';
import Toggle      from './shared/Toggle.jsx';
import NumberField from './shared/NumberField.jsx';
import Select      from './shared/Select.jsx';
import FormField   from './shared/FormField/FormField.jsx';
import FormFields  from './shared/FormField/FormFields.jsx';

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

/**
 * Map the modal's UI-facing source value to the canonical item_type / embed
 * source identifier the REST API expects. The backend keys its oEmbed
 * endpoints and stores item_type as 'video_youtube' / 'video_vimeo', while
 * the modal uses the shorter 'youtube' / 'vimeo' for its conditional UI.
 */
function canonicalSource( source ) {
    return source === 'vimeo' ? 'video_vimeo' : 'video_youtube';
}

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
    startTime:         0,
    endTime:           0,
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
    posterId:          0,
    posterUrl:         '',
    posterPreview:     '',
};

/**
 * Map the modal's camelCase form state to the snake_case embed_settings the
 * REST API stores. Only playback-relevant keys are included; identity fields
 * (url, videoId, caption) are sent as their own request params.
 *
 * @param {Object} form
 * @return {Object}
 */
function formToSettings( form ) {
    const settings = {
        autoplay:     !! form.autoplay,
        mute:         !! form.mute,
        loop:         !! form.loop,
        controls:     !! form.showControls,
        captions:     !! form.showCaptions,
        privacy_mode: !! form.privacyMode,
        suggested_videos: form.suggestedVideos || 'channel',
        intro_title:    !! form.showIntroTitle,
        intro_portrait: !! form.showIntroPortrait,
        intro_byline:   !! form.showIntroByline,
    };

    const startTime = parseInt( form.startTime, 10 ) || 0;
    if ( startTime > 0 ) {
        settings.start_time = startTime;
    }
    const endTime = parseInt( form.endTime, 10 ) || 0;
    if ( endTime > 0 ) {
        settings.end_time = endTime;
    }
    if ( form.controlsColor ) {
        settings.controls_color = form.controlsColor;
    }

    return settings;
}

/**
 * Map a stored embed item into modal form state for editing.
 *
 * @param {Object} editItem Grid item with an `embed` payload.
 * @return {Object} Form state.
 */
function editItemToForm( editItem ) {
    const embed    = editItem.embed || {};
    const settings = embed.settings || {};
    const source   = editItem.source === 'vimeo' ? 'vimeo' : 'youtube';

    return {
        ...DEFAULT_STATE,
        source,
        url:               embed.embed_url || '',
        videoId:           embed.video_id || null,
        thumbnailUrl:      embed.thumbnail_url || null,
        title:             embed.caption || '',
        caption:           embed.caption || '',
        startTime:         parseInt( settings.start_time, 10 ) || 0,
        endTime:           parseInt( settings.end_time, 10 ) || 0,
        autoplay:          !! settings.autoplay,
        mute:              !! settings.mute,
        loop:              !! settings.loop,
        privacyMode:       !! settings.privacy_mode,
        showControls:      settings.controls === undefined ? true : !! settings.controls,
        showCaptions:      !! settings.captions,
        suggestedVideos:   settings.suggested_videos || 'channel',
        showIntroTitle:    settings.intro_title === undefined ? true : !! settings.intro_title,
        showIntroPortrait: settings.intro_portrait === undefined ? true : !! settings.intro_portrait,
        showIntroByline:   settings.intro_byline === undefined ? true : !! settings.intro_byline,
        controlsColor:     settings.controls_color || '',
        posterId:          settings.poster_id || 0,
        posterUrl:         settings.poster_url || '',
        posterPreview:     settings.poster_url || '',
    };
}

const VideoEmbedModal = ( { isOpen, onClose, onAdd, onUpdate, editItem = null, strings = {} } ) => {

    const isEditing = !! editItem;

    const [ form, setForm ]           = useState( { ...DEFAULT_STATE } );
    const [ urlDraft, setUrlDraft ]   = useState( '' );
    const [ activeTab, setActiveTab ] = useState( 'link' );
    const [ resolving, setResolving ] = useState( false );
    const [ resolveError, setResolveError ] = useState( '' );
    const [ adding, setAdding ]       = useState( false );

    // Prefill the form when opening in edit mode; reset to defaults on open in
    // add mode. Keyed on the embed's id so re-opening a different embed reloads.
    useEffect( () => {
        if ( ! isOpen ) {
            return;
        }
        if ( editItem ) {
            setForm( editItemToForm( editItem ) );
            setUrlDraft( editItem.embed?.embed_url || '' );
            setResolveError( '' );
            setActiveTab( 'link' );
        } else {
            setForm( { ...DEFAULT_STATE } );
            setUrlDraft( '' );
            setResolveError( '' );
            setActiveTab( 'link' );
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ isOpen, editItem?.id ] );

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
                body:    JSON.stringify( { source: canonicalSource( form.source ), url } ),
            } );

            if ( ! res.ok ) throw new Error( `HTTP ${ res.status }` );
            const json = await res.json();

            if ( json.video_id ) {
                const resolvedTitle = json.title || '';
                setForm( prev => ( {
                    ...prev,
                    url,
                    videoId:      json.video_id,
                    thumbnailUrl: json.thumbnail_url || null,
                    title:        resolvedTitle,
                    // Seed the caption from the fetched title, but only when the
                    // user hasn't already typed one, so manual captions are kept.
                    caption:      prev.caption ? prev.caption : resolvedTitle,
                } ) );
                if ( window.fotogridsToast ) {
                    window.fotogridsToast.success( strings.videoLoaded || 'Video loaded successfully.' );
                }
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

        // Build the wire payload: identity fields plus a normalised
        // embed_settings object the REST endpoint stores in custom_data.
        const payload = {
            source:         form.source,
            url:            form.url,
            videoId:        form.videoId,
            // Fall back to the resolved title when the user left the caption
            // empty, so the embed always has a name (the caption field shows
            // the title as a placeholder, which is not a real value).
            caption:        form.caption || form.title,
            thumbnailUrl:   form.thumbnailUrl,
            embed_settings: formToSettings( form ),
            poster:         {
                poster_id:  form.posterId || 0,
                poster_url: form.posterUrl || '',
            },
        };

        try {
            if ( isEditing ) {
                await onUpdate( { ...payload, id: editItem.id } );
            } else {
                await onAdd( payload );
            }
            handleClose();
        } catch ( err ) {
            console.error( '[FotoGrids] VideoEmbedModal: save failed', err );
        } finally {
            setAdding( false );
        }
    }, [ form, isEditing, editItem, onAdd, onUpdate, handleClose ] );

    const hasVideo = !! form.videoId;

    // Reuse the plugin's existing color picker widget (plain global) by passing
    // a synthetic setting descriptor. Falls back to a native input.
    const renderControlsColor = () => {
        const renderer = window.FotoGridsRenderSettings?.renderColorPicker;
        if ( ! renderer ) {
            return (
                <input
                    id="fg-embed-color"
                    type="color"
                    value={ form.controlsColor || '#000000' }
                    onChange={ e => set( 'controlsColor', e.target.value ) }
                    className="fotogrids-embed-color-input"
                />
            );
        }
        return renderer(
            { key: 'controlsColor', default: '#000000' },
            form.controlsColor || '#000000',
            false,
            {
                updateSetting: ( key, value ) => set( 'controlsColor', value ),
                getFieldState: () => 'editable',
                __: ( s ) => s,
            }
        );
    };

    const choosePoster = () => {
        if ( ! window.wp || ! window.wp.media ) {
            return;
        }
        const frame = window.wp.media( {
            title:   strings.choosePoster || 'Choose Poster Image',
            library: { type: 'image' },
            button:  { text: strings.usePoster || 'Use as poster' },
            multiple: false,
        } );
        frame.on( 'select', () => {
            const attachment = frame.state().get( 'selection' ).first().toJSON();
            setForm( prev => ( {
                ...prev,
                posterId:      attachment.id,
                posterUrl:     attachment.url,
                posterPreview: ( attachment.sizes && attachment.sizes.medium )
                    ? attachment.sizes.medium.url
                    : attachment.url,
            } ) );
        } );
        frame.open();
    };

    const clearPoster = () => {
        setForm( prev => ( { ...prev, posterId: 0, posterUrl: '', posterPreview: '' } ) );
    };

    const previewSrc = form.posterPreview || form.posterUrl || form.thumbnailUrl;
    const hasCustomPoster = !! ( form.posterId || form.posterUrl );

    const renderSidebar = () => (
        <>
            <div className="fotogrids-item-preview">
                { hasVideo && previewSrc ? (
                    <img
                        src={ previewSrc }
                        alt={ form.title || 'Video thumbnail' }
                    />
                ) : (
                    <div className="fotogrids-item-preview__skeleton" />
                ) }
            </div>

            { hasVideo && (
                <div className="fotogrids-embed-poster-actions">
                    <Button variant="secondary" size="sm" onClick={ choosePoster }>
                        { hasCustomPoster
                            ? ( strings.changePoster || 'Change Poster' )
                            : ( strings.choosePoster || 'Choose Poster' ) }
                    </Button>
                    { hasCustomPoster && (
                        <Button variant="tertiary" size="sm" onClick={ clearPoster }>
                            { strings.removePoster || 'Remove' }
                        </Button>
                    ) }
                </div>
            ) }

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
            <FormFields>

                <FormField label={ strings.source || 'Source' } layout="column">
                    <div className="fg-button-group__buttons">
                        { SOURCES.map( src => (
                            <button
                                key={ src.value }
                                type="button"
                                className={ `fg-button-group__button ${ form.source === src.value ? 'fg-is-active' : '' }` }
                                onClick={ () => handleSourceChange( src.value ) }
                            >
                                <span className="fg-button-label">{ src.label }</span>
                            </button>
                        ) ) }
                    </div>
                </FormField>

                <FormField
                    label={ strings.link || 'Link' }
                    htmlFor="fg-embed-url"
                    layout="column"
                    error={ resolveError || undefined }
                >
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
                            className={ `fotogrids-embed-url-input ${ resolveError ? 'fotogrids-embed-url-input--error' : '' }` }
                            disabled={ resolving }
                            autoComplete="off"
                            spellCheck={ false }
                        />
                        <Button
                            variant="secondary"
                            className="fotogrids-embed-resolve-btn"
                            onClick={ () => resolveUrl( urlDraft ) }
                            disabled={ resolving || ! urlDraft }
                            ariaLabel={ strings.loadVideo || 'Load video' }
                            busy={ resolving }
                            icon="link"
                        />

                    </div>
                </FormField>

                <FormField
                    label={ strings.startTime || 'Start Time' }
                    htmlFor="fg-embed-start"
                    layout="column"
                >
                    <NumberField
                        id="fg-embed-start"
                        value={ form.startTime }
                        onChange={ v => set( 'startTime', v ) }
                        min={ 0 }
                        unit="s"
                        help={ strings.startTimeDesc || 'Specify a start time (in seconds)' }
                    />
                </FormField>

                {/* End time - YouTube only */}
                { form.source === 'youtube' && (
                    <FormField
                        label={ strings.endTime || 'End Time' }
                        htmlFor="fg-embed-end"
                        layout="column"
                    >
                        <NumberField
                            id="fg-embed-end"
                            value={ form.endTime }
                            onChange={ v => set( 'endTime', v ) }
                            min={ 0 }
                            unit="s"
                            help={ strings.endTimeDesc || 'Specify an end time (in seconds)' }
                        />
                    </FormField>
                ) }

                <FormField
                    label={ strings.caption || 'Caption' }
                    htmlFor="fg-embed-caption"
                    layout="column"
                >
                    <textarea
                        id="fg-embed-caption"
                        rows="3"
                        value={ form.caption }
                        onChange={ e => set( 'caption', e.target.value ) }
                        placeholder={ form.title || '' }
                    />
                </FormField>

            </FormFields>
        </div>
    );

    const renderYouTubeOptions = () => (
        <div className="fotogrids-tab-panel fg-is-active">
            <FormFields>

                <div className="fg-form-field">
                    <Toggle
                        id="fg-embed-autoplay"
                        label={ strings.autoplay || 'Autoplay' }
                        description={ strings.autoplayNote || 'Autoplay is subject to browser autoplay policies.' }
                        checked={ form.autoplay }
                        onChange={ v => set( 'autoplay', v ) }
                    />
                </div>

                <div className="fg-form-field">
                    <Toggle
                        id="fg-embed-mute"
                        label={ strings.mute || 'Mute' }
                        checked={ form.mute }
                        onChange={ v => set( 'mute', v ) }
                    />
                </div>

                <div className="fg-form-field">
                    <Toggle
                        id="fg-embed-loop"
                        label={ strings.loop || 'Loop' }
                        checked={ form.loop }
                        onChange={ v => set( 'loop', v ) }
                    />
                </div>

                <div className="fg-form-field">
                    <Toggle
                        id="fg-embed-controls"
                        label={ strings.playerControls || 'Player Controls' }
                        checked={ form.showControls }
                        onChange={ v => set( 'showControls', v ) }
                    />
                </div>

                <div className="fg-form-field">
                    <Toggle
                        id="fg-embed-captions"
                        label={ strings.captions || 'Captions' }
                        checked={ form.showCaptions }
                        onChange={ v => set( 'showCaptions', v ) }
                    />
                </div>

                <div className="fg-form-field">
                    <Toggle
                        id="fg-embed-privacy"
                        label={ strings.privacyMode || 'Privacy Mode' }
                        description={ strings.privacyModeNote || "When on, YouTube won't store information about visitors unless they play the video." }
                        checked={ form.privacyMode }
                        onChange={ v => set( 'privacyMode', v ) }
                    />
                </div>

                <FormField
                    label={ strings.suggestedVideos || 'Suggested Videos' }
                    htmlFor="fg-embed-suggested"
                    layout="column"
                >
                    <Select
                        value={ form.suggestedVideos }
                        onChange={ v => set( 'suggestedVideos', v ) }
                        options={ SUGGESTED_VIDEOS_OPTIONS }
                    />
                </FormField>

            </FormFields>
        </div>
    );

    const renderVimeoOptions = () => (
        <div className="fotogrids-tab-panel fg-is-active">
            <FormFields>

                <div className="fg-form-field">
                    <Toggle
                        id="fg-embed-autoplay"
                        label={ strings.autoplay || 'Autoplay' }
                        description={ strings.autoplayNote || 'Autoplay is subject to browser autoplay policies.' }
                        checked={ form.autoplay }
                        onChange={ v => set( 'autoplay', v ) }
                    />
                </div>

                <div className="fg-form-field">
                    <Toggle
                        id="fg-embed-mute"
                        label={ strings.mute || 'Mute' }
                        checked={ form.mute }
                        onChange={ v => set( 'mute', v ) }
                    />
                </div>

                <div className="fg-form-field">
                    <Toggle
                        id="fg-embed-loop"
                        label={ strings.loop || 'Loop' }
                        checked={ form.loop }
                        onChange={ v => set( 'loop', v ) }
                    />
                </div>

                <div className="fg-form-field">
                    <Toggle
                        id="fg-embed-privacy"
                        label={ strings.privacyMode || 'Privacy Mode' }
                        description={ strings.privacyModeNote || "When on, Vimeo won't store information about visitors unless they play the video." }
                        checked={ form.privacyMode }
                        onChange={ v => set( 'privacyMode', v ) }
                    />
                </div>

                <div className="fg-form-field">
                    <Toggle
                        id="fg-embed-intro-title"
                        label={ strings.introTitle || 'Intro Title' }
                        checked={ form.showIntroTitle }
                        onChange={ v => set( 'showIntroTitle', v ) }
                    />
                </div>

                <div className="fg-form-field">
                    <Toggle
                        id="fg-embed-intro-portrait"
                        label={ strings.introPortrait || 'Intro Portrait' }
                        checked={ form.showIntroPortrait }
                        onChange={ v => set( 'showIntroPortrait', v ) }
                    />
                </div>

                <div className="fg-form-field">
                    <Toggle
                        id="fg-embed-intro-byline"
                        label={ strings.introByline || 'Intro Byline' }
                        checked={ form.showIntroByline }
                        onChange={ v => set( 'showIntroByline', v ) }
                    />
                </div>

                <FormField
                    label={ strings.controlsColor || 'Controls Color' }
                    htmlFor="fg-embed-color"
                    layout="column"
                >
                    { renderControlsColor() }
                </FormField>

            </FormFields>
        </div>
    );

    const tabs = TABS[ form.source ];

    const tabItems = tabs.map(tab => ({ id: tab.id, label: tab.label }));

    return (
        <Modal
            isOpen={ isOpen }
            onClose={ handleClose }
            size="md"
            hasSidebar
            closeOnOverlay={ false }
            preventClose={ adding }
        >
            <Modal.Header>
                <Modal.HeaderTitle>
                    { isEditing
                        ? ( strings.editVideoEmbed || 'Edit Video Embed' )
                        : ( strings.addVideoEmbed  || 'Add Video Embed' ) }
                </Modal.HeaderTitle>
            </Modal.Header>

            <Modal.Body padding={ false }>
                <Modal.Sidebar>
                    { renderSidebar() }
                </Modal.Sidebar>

                <Modal.Main>
                    <Modal.Tabs
                        tabs={ tabItems }
                        activeId={ activeTab }
                        onChange={ setActiveTab }
                    />
                    <Modal.TabsPanel id="link" activeId={ activeTab }>
                        { renderLinkTab() }
                    </Modal.TabsPanel>
                    <Modal.TabsPanel id="options" activeId={ activeTab }>
                        { form.source === 'youtube' ? renderYouTubeOptions() : renderVimeoOptions() }
                    </Modal.TabsPanel>
                </Modal.Main>
            </Modal.Body>

            <Modal.Footer>
                <Button variant="secondary" onClick={ handleClose } disabled={ adding }>
                    { strings.cancel || 'Cancel' }
                </Button>
                <Button
                    variant="primary"
                    onClick={ handleAdd }
                    disabled={ ! hasVideo }
                    busy={ adding }
                >
                    { adding
                        ? ( isEditing ? ( strings.saving || 'Saving…' ) : ( strings.adding || 'Adding…' ) )
                        : ( isEditing
                            ? ( strings.saveChanges  || 'Save Changes' )
                            : ( strings.addToGallery || 'Add to Gallery' ) )
                    }
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default VideoEmbedModal;
