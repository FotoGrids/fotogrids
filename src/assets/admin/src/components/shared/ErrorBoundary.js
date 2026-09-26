/**
 * Admin error boundary for the webpack-bundled admin entries.
 *
 * The implementation lives in `assets/admin/plain/error-boundary.js` so the
 * bundles and the non-bundled settings script share one boundary; importing it
 * here registers the globals this module re-exports.
 */

import '../../../plain/error-boundary.js';

export const ErrorBoundary = window.FotoGridsAdmin.ErrorBoundary;
export const withErrorBoundary = window.FotoGridsAdmin.withErrorBoundary;

export default ErrorBoundary;
