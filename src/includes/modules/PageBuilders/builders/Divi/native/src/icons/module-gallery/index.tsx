import React, { ReactElement } from 'react';

// FotoGrids brand gallery icon — multi-colour 3x3 grid, drawn on a 16x16
// grid (Divi forces viewBox="0 0 16 16" and ignores our export). Returns
// inner elements only; Divi supplies the <svg> wrapper.
export const name    = 'fotogrids/module-gallery';
export const viewBox = '0 0 16 16';
export const component = (): ReactElement => (
  <>
    <rect x="1" y="1" width="3.6" height="3.6" rx="0.6" fill="none" stroke="#3c46f0" stroke-width="0.9" />
    <rect x="6.2" y="1" width="3.6" height="3.6" rx="0.6" fill="none" stroke="#3c46f0" stroke-width="0.9" />
    <rect x="11.4" y="1" width="3.6" height="3.6" rx="0.6" fill="none" stroke="#3c46f0" stroke-width="0.9" />
    <rect x="1" y="6.2" width="3.6" height="3.6" rx="0.6" fill="none" stroke="#f01e32" stroke-width="0.9" />
    <rect x="6.2" y="6.2" width="3.6" height="3.6" rx="0.6" fill="none" stroke="#f01e32" stroke-width="0.9" />
    <rect x="11.4" y="6.2" width="3.6" height="3.6" rx="0.6" fill="none" stroke="#323232" stroke-width="0.9" />
    <rect x="1" y="11.4" width="3.6" height="3.6" rx="0.6" fill="none" stroke="#ffb914" stroke-width="0.9" />
    <rect x="6.2" y="11.4" width="3.6" height="3.6" rx="0.6" fill="none" stroke="#323232" stroke-width="0.9" />
    <rect x="11.4" y="11.4" width="3.6" height="3.6" rx="0.6" fill="none" stroke="#323232" stroke-width="0.9" />
  </>
);
