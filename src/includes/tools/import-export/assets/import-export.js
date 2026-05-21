/**
 * Import / Export Tool — entry point
 *
 * Compiled by Webpack as the 'tool-import-export' entry and output to
 * dist/includes/tools/import-export/assets/import-export.js.
 *
 * Enqueued by Import_Export_Tool::enqueue_assets() (via Abstract_Tool)
 * only when this tool is the active tool on the Tools page, and only after
 * the fotogrids-admin bundle has loaded — so window.FotoGridsToolsComponents
 * is guaranteed to be available here.
 */
import ImportExportTool from './ImportExportTool.jsx';

window.FotoGridsToolsComponents.register( 'import-export', ImportExportTool );
