import React, { useState, useEffect, useCallback } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import Panel from '@/admin/src/components/shared/SidebarTabs/elements/Panel.jsx';
import PanelRow from '@/admin/src/components/shared/SidebarTabs/elements/PanelRow.jsx';
import FileUpload from '@/admin/src/components/blocks/FileUpload.jsx';
import Segmented from '@/admin/src/components/shared/Segmented.jsx';
import DangerZone from '@/admin/src/components/shared/DangerZone.jsx';
import Toggle from '@/admin/src/components/shared/Toggle.jsx';
import ToggleList from '@/admin/src/components/shared/ToggleList.jsx';
import TabBar from '@/admin/src/components/shared/TabBar.jsx';
import Icon from '@/admin/src/components/shared/Icon.jsx';

const EXPORT_TYPES = [
    {
        key:         'galleries',
        label:       __( 'Galleries',  'fotogrids' ),
        description: __( 'Gallery records and their display settings.', 'fotogrids' ),
        conflict:    true,
    },
    {
        key:         'albums',
        label:       __( 'Albums',     'fotogrids' ),
        description: __( 'Albums and the galleries they contain.', 'fotogrids' ),
        conflict:    true,
    },
    {
        key:         'items',
        label:       __( 'Items',      'fotogrids' ),
        description: __( 'Gallery items and their metadata (captions, alt text, order).', 'fotogrids' ),
    },
    {
        key:    'item_metadata',
        label:  __( 'Item Metadata', 'fotogrids' ),
        hidden: true, // imported automatically with items; not a separate user choice
    },
    {
        key:         'tags',
        label:       __( 'Tags',       'fotogrids' ),
        description: __( 'Tags, people, and locations referenced by gallery items.', 'fotogrids' ),
    },
    {
        key:         'settings',
        label:       __( 'Settings',   'fotogrids' ),
        description: __( 'Plugin settings — overwrites the settings on this site.', 'fotogrids' ),
    },
    {
        key:         'statistics',
        label:       __( 'Statistics', 'fotogrids' ),
        description: __( 'View and share counts. Useful when migrating between sites.', 'fotogrids' ),
    },
    {
        key:         'templates',
        label:       __( 'Templates',  'fotogrids' ),
        description: __( 'Saved gallery templates included in the export file.', 'fotogrids' ),
    },
];

const CONFLICT_OPTIONS = [
    { value: 'skip',      label: __( 'Skip existing', 'fotogrids' ) },
    { value: 'overwrite', label: __( 'Overwrite',     'fotogrids' ) },
    { value: 'duplicate', label: __( 'Duplicate',     'fotogrids' ) },
];

const TABS = [
    { id: 'export',  label: __( 'Export',  'fotogrids' ), icon: 'export' },
    { id: 'import',  label: __( 'Import',  'fotogrids' ), icon: 'import' },
    { id: 'history', label: __( 'History', 'fotogrids' ), icon: 'list'   },
];

function formatBytes( bytes ) {
    if ( bytes < 1024 ) return bytes + ' B';
    if ( bytes < 1048576 ) return ( bytes / 1024 ).toFixed( 1 ) + ' KB';
    return ( bytes / 1048576 ).toFixed( 1 ) + ' MB';
}

function formatDate( iso ) {
    try { return new Date( iso ).toLocaleString(); } catch { return iso; }
}

const OperationBanner = ( { message } ) => (
    <div className="fg-ie-banner">
        <span className="fg-ie-banner__spinner" aria-hidden="true" />
        <span className="fg-ie-banner__message">{ message }</span>
    </div>
);

const ExportPanel = ( { onOperationStart, onOperationEnd } ) => {
    const allKeys = EXPORT_TYPES.map( t => t.key );
    const [ include, setInclude ] = useState( new Set( allKeys ) );
    const [ format, setFormat ]   = useState( 'json' );
    const [ busy, setBusy ]       = useState( false );
    const [ error, setError ]     = useState( null );

    const toggleType = ( key ) => {
        setInclude( prev => {
            const next = new Set( prev );
            next.has( key ) ? next.delete( key ) : next.add( key );
            return next;
        } );
    };

    const toggleAll = () => {
        setInclude( include.size === allKeys.length ? new Set() : new Set( allKeys ) );
    };

    const handleExport = async () => {
        if ( include.size === 0 ) return;
        setBusy( true );
        setError( null );
        onOperationStart( __( 'Exporting - please do not close this window…', 'fotogrids' ) );

        try {
            const url = new URL(
                wpApiSettings.root + 'fotogrids/v1/admin/tools/import-export/export',
                window.location.href
            );
            [ ...include ].forEach( v => url.searchParams.append( 'include[]', v ) );
            url.searchParams.set( 'format', format );

            const response = await fetch( url.toString(), {
                headers: { 'X-WP-Nonce': wpApiSettings.nonce },
            } );

            if ( ! response.ok ) {
                const json = await response.json().catch( () => ({}) );
                throw new Error( json.message || __( 'Export failed.', 'fotogrids' ) );
            }

            const blob    = await response.blob();
            const anchor  = document.createElement( 'a' );
            anchor.href   = URL.createObjectURL( blob );
            anchor.download = `fotogrids-export.${ format }`;
            document.body.appendChild( anchor );
            anchor.click();
            document.body.removeChild( anchor );
            URL.revokeObjectURL( anchor.href );
        } catch ( err ) {
            setError( err.message || __( 'Export failed.', 'fotogrids' ) );
        } finally {
            setBusy( false );
            onOperationEnd();
        }
    };

    return (
        <>
            <Panel
                title={ __( 'What to export', 'fotogrids' ) }
                titleTag="h3"
                equalBodyPadding
                action={
                    <Toggle
                        id="fg-ie-export-select-all"
                        checked={ include.size === allKeys.length }
                        onChange={ () => toggleAll() }
                        label={ __( 'Select all', 'fotogrids' ) }
                        labelLight
                        size="small"
                    />
                }
            >
                <ToggleList noBorder>
                    { EXPORT_TYPES.map( ( { key, label } ) => (
                        <Toggle
                            key={ key }
                            id={ `fg-ie-export-${ key }` }
                            checked={ include.has( key ) }
                            onChange={ () => toggleType( key ) }
                            label={ label }
                        />
                    ) ) }
                </ToggleList>
            </Panel>

            <Panel
                title={ __( 'File format', 'fotogrids' ) }
                titleTag="h3"
            >
                <PanelRow
                    title={ __( 'Export file format', 'fotogrids' ) }
                    description={
                        format === 'json'
                            ? __( 'JSON is compact and works with most migration tools.', 'fotogrids' )
                            : __( 'XML is more verbose and can be edited in any text editor.', 'fotogrids' )
                    }
                >
                    <Segmented
                        options={ [
                            { value: 'json', label: 'JSON' },
                            { value: 'xml',  label: 'XML'  },
                        ] }
                        value={ format }
                        onChange={ setFormat }
                        ariaLabel={ __( 'Export file format', 'fotogrids' ) }
                    />
                </PanelRow>

                { error && (
                    <div className="fg-ie-error-notice" role="alert">{ error }</div>
                ) }

                <div className="fg-ie-actions">
                    <button
                        type="button"
                        className="fotogrids-button fotogrids-button--primary"
                        disabled={ busy || include.size === 0 }
                        onClick={ handleExport }
                    >
                        { busy ? __( 'Exporting…', 'fotogrids' ) : __( 'Export', 'fotogrids' ) }
                    </button>
                    { include.size === 0 && (
                        <span className="fg-ie-warning">
                            { __( 'Select at least one item to export.', 'fotogrids' ) }
                        </span>
                    ) }
                </div>
            </Panel>
        </>
    );
};

const FileSummary = ( { file, summary } ) => {
    const counts = summary?.contents ?? {};
    // Drive chips from EXPORT_TYPES order so hidden/unknown keys from the API
    // are either labelled correctly or suppressed — never shown as raw key names.
    const chips = EXPORT_TYPES
        .filter( ( { key } ) => counts[ key ] > 0 );

    console.log( 'counts', counts );
    console.log( 'chips', chips );

    return (
        <div className="fg-ie-summary">
            <div className="fg-ie-summary__file">
                <span className="fg-ie-summary__file-name">{ file.name }</span>
                <span className="fg-ie-summary__file-size">{ formatBytes( file.size ) }</span>
            </div>
            { chips.length > 0 && (
                <div className="fg-ie-summary__chips">
                    { chips.map( ( { key, label } ) => {
                        const n = counts[ key ];
                        const showCount = typeof n === 'number' && n > 0;
                        return (
                            <span key={ key } className="fg-ie-summary__chip">
                                { showCount && <><strong>{ n }</strong>{ ' ' }</> }{ label }
                            </span>
                        );
                    } ) }
                </div>
            ) }
        </div>
    );
};

const ImportPanel = ( { onOperationStart, onOperationEnd } ) => {
    const [ phase, setPhase ]               = useState( 'idle' );
    const [ file, setFile ]                 = useState( null );
    const [ summary, setSummary ]           = useState( null );
    const [ analyseError, setAnalyseError ] = useState( null );
    const [ importError, setImportError ]   = useState( null );
    const [ include, setInclude ]       = useState( new Set() );
    const [ conflictMode, setConflictMode ] = useState( {} ); // { [key]: 'skip'|'overwrite'|'duplicate' }

    const getConflictMode = ( key ) => conflictMode[ key ] ?? 'skip';
    const setTypeConflictMode = ( key, value ) =>
        setConflictMode( prev => ( { ...prev, [ key ]: value } ) );

    const handleFileReady = async ( fileObj ) => {
        setFile( fileObj );
        setPhase( 'analysing' );
        setAnalyseError( null );
        setSummary( null );

        try {
            const response = await apiFetch( {
                path: '/fotogrids/v1/admin/tools/import-export/import',
                method: 'POST',
                data: { phase: 'analyse', file: fileObj.text },
            } );
            setSummary( response );
            const availableKeys = EXPORT_TYPES
                .filter( ( { hidden } ) => ! hidden )
                .map( ( { key } ) => key )
                .filter( k => ( response?.contents ?? {} )[ k ] > 0 );
            setInclude( new Set( availableKeys ) );
            setPhase( 'ready' );
        } catch ( err ) {
            setAnalyseError( err.message || __( 'Could not analyse the file.', 'fotogrids' ) );
            setPhase( 'idle' );
        }
    };

    const resetFile = () => {
        setFile( null );
        setSummary( null );
        setPhase( 'idle' );
        setAnalyseError( null );
        setImportError( null );
    };

    const toggleInclude = ( key ) => {
        setInclude( prev => {
            const next = new Set( prev );
            next.has( key ) ? next.delete( key ) : next.add( key );
            return next;
        } );
    };

    const handleImport = async () => {
        setPhase( 'importing' );
        setImportError( null );
        onOperationStart( __( 'Importing - please do not close this window…', 'fotogrids' ) );

        try {
            await apiFetch( {
                path: '/fotogrids/v1/admin/tools/import-export/import',
                method: 'POST',
                data: {
                    phase:         'execute',
                    file:          file.text,
                    include:       [ ...include ],
                    conflict_mode: conflictMode,
                },
            } );
            setPhase( 'done' );
        } catch ( err ) {
            setImportError( err.message || __( 'Import failed.', 'fotogrids' ) );
            setPhase( 'ready' );
        } finally {
            onOperationEnd();
        }
    };

    const counts         = summary?.contents ?? {};
    const availableTypes = EXPORT_TYPES.filter( ( { key, hidden } ) => ! hidden && counts[ key ] > 0 );

    if ( phase === 'done' ) {
        return (
            <Panel
                title={ __( 'Select export file', 'fotogrids' ) }
                titleTag="h3"
                equalBodyPadding
            >
                <div className="fg-ie-done">
                    <Icon name="check_badge_gi" />
                    <div className="fg-ie-done__content">
                        <h3>{ __( 'Import complete', 'fotogrids' ) }</h3>
                        <p>{ __( 'Your data has been imported successfully.', 'fotogrids' ) }</p>
                    </div>
                    <button type="button" className="fotogrids-button fotogrids-button--primary" onClick={ resetFile }>
                        { __( 'Import another file', 'fotogrids' ) }
                    </button>
                </div>
            </Panel>
        );
    }

    return (
        <>
            <Panel
                title={ ! file ? __( 'Select export file', 'fotogrids' ) : __( 'Selected export file', 'fotogrids' ) }
                titleTag="h3"
                equalBodyPadding
                action={ file && (
                    <button type="button" className="fg-ie-link-btn" onClick={ resetFile }>
                        { __( 'Choose a different file', 'fotogrids' ) }
                    </button>
                ) }
            >
                { phase === 'idle' || phase === 'analysing' ? (
                    <>
                        <FileUpload
                            accept=".json,.xml"
                            title={ __( 'Select file to import', 'fotogrids' ) }
                            subtitle={ __( 'Drop your .json or .xml export file here', 'fotogrids' ) }
                            hint={ __( 'Supported formats: JSON, XML', 'fotogrids' ) }
                            onFileReady={ handleFileReady }
                            inputId="fg-ie-import-file"
                        />
                        { phase === 'analysing' && (
                            <p className="fg-ie-hint fg-ie-hint--loading" aria-live="polite">
                                { __( 'Analysing file…', 'fotogrids' ) }
                            </p>
                        ) }
                        { analyseError && (
                            <div className="fg-ie-error-notice" role="alert">{ analyseError }</div>
                        ) }
                    </>
                ) : (
                    <FileSummary file={ file } summary={ summary } />
                ) }
            </Panel>

            { ( phase === 'ready' || phase === 'importing' ) && (
                <Panel
                    title={ __( 'What to import', 'fotogrids' ) }
                    titleTag="h3"
                >
                    { availableTypes.map( ( { key, label, description, conflict } ) => {
                        const count   = counts[ key ];
                        const checked = include.has( key );

                        console.log( 'key', key );
                        console.log( 'count', count );

                        const showCount = typeof count === 'number' && count > 0;
                        const title   = (
                            <>
                                { label }
                                { showCount && (
                                    <>
                                        { ' ' }
                                        <span className="fg-ie-import-count">{ count }</span>
                                    </>
                                ) }
                            </>
                        );

                        return (
                            <PanelRow
                                key={ key }
                                title={ title }
                                description={ description }
                                splitColumns
                                className="fg-ie-import-row"
                            >
                                <div className="fg-ie-import-row-control">
                                    { conflict && checked && (
                                        <Segmented
                                            options={ CONFLICT_OPTIONS }
                                            value={ getConflictMode( key ) }
                                            onChange={ ( v ) => setTypeConflictMode( key, v ) }
                                            disabled={ phase === 'importing' }
                                            ariaLabel={ label + ' ' + __( 'conflict handling', 'fotogrids' ) }
                                        />
                                    ) }
                                    <Toggle
                                        id={ `fg-ie-import-${ key }` }
                                        checked={ checked }
                                        onChange={ () => toggleInclude( key ) }
                                        disabled={ phase === 'importing' }
                                    />
                                </div>
                            </PanelRow>
                        );
                    } ) }

                    { importError && (
                        <div className="fg-ie-error-notice" role="alert">{ importError }</div>
                    ) }

                    <DangerZone
                        title={ __( 'Ready to import', 'fotogrids' ) }
                        description={ __(
                            'We recommend taking a database backup before importing. This action cannot be undone.',
                            'fotogrids'
                        ) }
                    >
                        <button
                            type="button"
                            className="fotogrids-button fotogrids-button--primary"
                            disabled={ phase === 'importing' || include.size === 0 }
                            onClick={ handleImport }
                        >
                            { phase === 'importing'
                                ? __( 'Importing…', 'fotogrids' )
                                : __( 'Import', 'fotogrids' ) }
                        </button>
                    </DangerZone>
                </Panel>
            ) }
        </>
    );
};

const HistoryPanel = () => {
    const [ log, setLog ]         = useState( null );
    const [ loading, setLoading ] = useState( true );
    const [ error, setError ]     = useState( null );

    useEffect( () => {
        apiFetch( { path: '/fotogrids/v1/admin/tools/import-export/log' } )
            .then( data => setLog( data?.log ?? [] ) )
            .catch( err => setError( err.message || __( 'Could not load operation log.', 'fotogrids' ) ) )
            .finally( () => setLoading( false ) );
    }, [] );

    return (
        <Panel
            title={ __( 'Import / Export Log', 'fotogrids' ) }
            titleTag="h3"
        >
            { loading && (
                <p className="fg-ie-hint">{ __( 'Loading log…', 'fotogrids' ) }</p>
            ) }

            { ! loading && error && (
                <div className="fg-ie-error-notice" role="alert">{ error }</div>
            ) }

            { ! loading && ! error && ( ! log || log.length === 0 ) && (
                <p className="fg-ie-empty">
                    { __( 'No operations recorded yet. Export or import data to see a log here.', 'fotogrids' ) }
                </p>
            ) }

            { ! loading && ! error && log && log.length > 0 && (
                <table className="fg-ie-log-table widefat striped">
                    <thead>
                        <tr>
                            <th>{ __( 'Date',      'fotogrids' ) }</th>
                            <th>{ __( 'Type',      'fotogrids' ) }</th>
                            <th>{ __( 'Details',   'fotogrids' ) }</th>
                            <th>{ __( 'Status',    'fotogrids' ) }</th>
                        </tr>
                    </thead>
                    <tbody>
                        { log.map( ( entry ) => (
                            <tr key={ entry.id }>
                                <td className="fg-ie-log-date">{ formatDate( entry.date ) }</td>
                                <td className="fg-ie-log-op">{ entry.type }</td>
                                <td className="fg-ie-log-detail">{ entry.summary || '-' }</td>
                                <td>
                                    <span className={ `fg-ie-status-pill fg-ie-status-pill--${ entry.status }` }>
                                        { entry.status }
                                    </span>
                                </td>
                            </tr>
                        ) ) }
                    </tbody>
                </table>
            ) }
        </Panel>
    );
};

const ImportExportTool = () => {
    const [ activeTab, setActiveTab ]               = useState( 'export' );
    const [ operationMessage, setOperationMessage ] = useState( null );

    const handleOperationStart = useCallback( ( msg ) => setOperationMessage( msg ), [] );
    const handleOperationEnd   = useCallback( () => setOperationMessage( null ), [] );

    useEffect( () => {
        if ( ! operationMessage ) return;
        const handler = ( e ) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener( 'beforeunload', handler );
        return () => window.removeEventListener( 'beforeunload', handler );
    }, [ operationMessage ] );

    return (
        <div className="fotogrids-sidebar-tabs__content__inner fg-ie-root">
            { operationMessage && <OperationBanner message={ operationMessage } /> }

            <Panel
                title={ __( 'Import / Export', 'fotogrids' ) }
                description={ __( 'Move gallery data between sites, or keep a safe copy of your galleries, albums, items, statistics, and settings.', 'fotogrids' ) }
                noBodyPadding
            >
                <TabBar
                    tabs={ TABS }
                    activeTab={ activeTab }
                    onTabChange={ setActiveTab }
                />
            </Panel>

            { activeTab === 'export'  && (
                <ExportPanel
                    onOperationStart={ handleOperationStart }
                    onOperationEnd={ handleOperationEnd }
                />
            ) }
            { activeTab === 'import'  && (
                <ImportPanel
                    onOperationStart={ handleOperationStart }
                    onOperationEnd={ handleOperationEnd }
                />
            ) }
            { activeTab === 'history' && <HistoryPanel /> }
        </div>
    );
};

export default ImportExportTool;
