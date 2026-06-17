import React, { ReactElement } from 'react';

// FotoGrids brand album icon - multi-colour 2x2 grid, drawn on a 16x16
// grid because Divi forces its icon wrapper to viewBox="0 0 16 16" (it
// ignores our exported viewBox). Returns inner elements only.
export const name    = 'fotogrids/module-album';
export const viewBox = '0 0 16 16';
export const component = (): ReactElement => (
  <>
    <rect x="2" y="2" width="5" height="5" rx="1" fill="none" stroke="#3c46f0" strokeWidth="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" fill="none" stroke="#323232" strokeWidth="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" fill="none" stroke="#ffb914" strokeWidth="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" fill="none" stroke="#f01e32" strokeWidth="1" />
  </>
);
