/**
 * Admin error boundary for the webpack-bundled entries. Importing the plain
 * implementation registers the globals re-exported here.
 */

import '../../../plain/error-boundary.js';

export const ErrorBoundary = window.FotoGridsAdmin.ErrorBoundary;
export const withErrorBoundary = window.FotoGridsAdmin.withErrorBoundary;

export default ErrorBoundary;
