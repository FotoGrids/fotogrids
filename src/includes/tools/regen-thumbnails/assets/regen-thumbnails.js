/**
 * Regen Thumbnails Tool — entry point
 *
 * Compiled by Webpack as the 'tool-regen-thumbnails' entry and output to
 * dist/includes/tools/regen-thumbnails/assets/regen-thumbnails.js.
 *
 * Enqueued by Regen_Thumbnails_Tool::enqueue_assets() (via Abstract_Tool)
 * only when this tool is the active tool on the Tools page, and only after
 * the fotogrids-admin bundle has loaded — so window.FotoGridsToolsComponents
 * is guaranteed to be available here.
 */
import RegenThumbnailsTool from './RegenThumbnailsTool.jsx';

window.FotoGridsToolsComponents.register( 'regen-thumbnails', RegenThumbnailsTool );
