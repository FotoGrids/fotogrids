import React, { useId } from 'react';

// Unique-ID template for the FotoGrids loading icon SMIL animations.
// Each instance gets its own ID suffix so multiple loaders on the same page
// don't share animation IDs (which would break SMIL begin/end chaining).
const buildSvg = ( id, size ) => {
    const p = id; // shorthand
    return `<svg width="${ size }" height="${ size }" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <rect x="0" y="0" width="0" height="6">
    <animate id="fg_ia_fotogrids_1___${ p }__" begin="0;fg_ia_fotogrids_10___${ p }__.end-0.3s" attributeName="width" dur="0.4s" values="0;24" fill="freeze"/>
    <animate begin="fg_ia_fotogrids_6___${ p }__.end-0.2s" attributeName="width" dur="0.4s" values="24;0" fill="freeze"/>
    <animate id="fg_ia_fotogrids_2___${ p }__" begin="fg_ia_fotogrids_6___${ p }__.end-0.2s" attributeName="x" dur="0.4s" values="0;24"/>
  </rect>
  <rect x="0" y="9" width="0" height="6">
    <animate id="fg_ia_fotogrids_3___${ p }__" begin="fg_ia_fotogrids_1___${ p }__.end-0.2s" attributeName="width" dur="0.4s" values="0;15" fill="freeze"/>
    <animate begin="fg_ia_fotogrids_2___${ p }__.end-0.2s" attributeName="width" dur="0.4s" values="15;0" fill="freeze"/>
    <animate id="fg_ia_fotogrids_7___${ p }__" begin="fg_ia_fotogrids_2___${ p }__.end-0.2s" attributeName="x" dur="0.4s" values="0;15"/>
  </rect>
  <rect x="0" y="18" width="0" height="6">
    <animate id="fg_ia_fotogrids_4___${ p }__" begin="fg_ia_fotogrids_3___${ p }__.end-0.2s" attributeName="width" dur="0.2s" values="0;6" fill="freeze"/>
    <animate begin="fg_ia_fotogrids_7___${ p }__.end-0.1s" attributeName="width" dur="0.2s" values="6;0" fill="freeze"/>
    <animate id="fg_ia_fotogrids_8___${ p }__" begin="fg_ia_fotogrids_7___${ p }__.end-0.1s" attributeName="x" dur="0.2s" values="0;6"/>
  </rect>
  <rect x="9" y="18" width="6" height="0">
    <animate id="fg_ia_fotogrids_5___${ p }__" begin="fg_ia_fotogrids_4___${ p }__.end+0.1s" attributeName="height" dur="0.2s" values="0;6" fill="freeze"/>
    <animate begin="fg_ia_fotogrids_4___${ p }__.end+0.1s" attributeName="y" dur="0.2s" values="24;18" fill="freeze"/>
    <animate id="fg_ia_fotogrids_9___${ p }__" begin="fg_ia_fotogrids_8___${ p }__.end+0.1s" attributeName="height" dur="0.2s" values="6;0" fill="freeze"/>
    <animate begin="fg_ia_fotogrids_9___${ p }__.end+0.1s" attributeName="y" dur="0" values="18;24"/>
  </rect>
  <rect x="18" y="9" width="6" height="0">
    <animate begin="fg_ia_fotogrids_5___${ p }__.end+0.1s" attributeName="height" dur="0.4s" values="0;15" fill="freeze"/>
    <animate id="fg_ia_fotogrids_6___${ p }__" begin="fg_ia_fotogrids_5___${ p }__.end+0.1s" attributeName="y" dur="0.4s" values="24;9" fill="freeze"/>
    <animate id="fg_ia_fotogrids_10___${ p }__" begin="fg_ia_fotogrids_9___${ p }__.end-0.1s" attributeName="height" dur="0.4s" values="15;0" fill="freeze"/>
    <animate begin="fg_ia_fotogrids_10___${ p }__.end" attributeName="y" dur="0" values="9;24"/>
  </rect>
</svg>`;
};

/**
 * LoadingScreen
 *
 * Displays the FotoGrids animated loading icon centred inside its container.
 *
 * Props:
 *   label  {string}  Visible text below the icon.  Defaults to "Loading…"
 *   size   {number}  Icon size in px.  Defaults to 32.
 */
const LoadingScreen = ( { label = 'Loading…', size = 32 } ) => {
    const rawId = useId().replace( /:/g, '' );
    return (
        <div className="fotogrids-loading-screen">
            <span
                className="fotogrids-loading-screen__icon"
                style={ { width: size, height: size } }
                aria-hidden="true"
                dangerouslySetInnerHTML={ { __html: buildSvg( rawId, size ) } }
            />
            { label && (
                <span className="fotogrids-loading-screen__label">{ label }</span>
            ) }
        </div>
    );
};

export default LoadingScreen;
