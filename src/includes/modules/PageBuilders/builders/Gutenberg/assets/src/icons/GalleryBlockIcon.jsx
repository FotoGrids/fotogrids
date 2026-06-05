/**
 * Inserter / list icon for the FotoGrids Gallery block.
 *
 * Multi-colour 3x3 grid using the FotoGrids brand palette. The SVG
 * carries its own stroke colours per cell, so we register it directly
 * (without WordPress' `foreground` recolour mechanism, which can only
 * apply a single color).
 *
 * Sized to WordPress' canonical 24x24 viewBox; rendered at the inserter
 * size by the block-type listing.
 */

import React from 'react';

const GalleryBlockIcon = (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
    >
        <rect x="3"  y="3"  width="4" height="4" rx="0.2" fill="none" stroke="#3c46f0" strokeWidth="1.4" />
        <rect x="10" y="3"  width="4" height="4" rx="0.2" fill="none" stroke="#3c46f0" strokeWidth="1.4" />
        <rect x="17" y="3"  width="4" height="4" rx="0.2" fill="none" stroke="#3c46f0" strokeWidth="1.4" />
        <rect x="3"  y="10" width="4" height="4" rx="0.2" fill="none" stroke="#f01e32" strokeWidth="1.4" />
        <rect x="10" y="10" width="4" height="4" rx="0.2" fill="none" stroke="#f01e32" strokeWidth="1.4" />
        <rect x="17" y="10" width="4" height="4" rx="0.2" fill="none" stroke="#323232" strokeWidth="1.4" />
        <rect x="3"  y="17" width="4" height="4" rx="0.2" fill="none" stroke="#ffb914" strokeWidth="1.4" />
        <rect x="10" y="17" width="4" height="4" rx="0.2" fill="none" stroke="#323232" strokeWidth="1.4" />
        <rect x="17" y="17" width="4" height="4" rx="0.2" fill="none" stroke="#323232" strokeWidth="1.4" />
    </svg>
);

export default GalleryBlockIcon;
