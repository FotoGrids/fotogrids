/**
 * Regen Thumbnails — component registration.
 *
 * Imported by tools/index.js. Registers the React component
 * into FotoGridsToolsComponents under the id 'regen-thumbnails',
 * which matches the component id returned by the PHP manifest.
 */
import ToolsComponents from '../registry.js';
import RegenThumbnailsTool from './RegenThumbnailsTool.jsx';

ToolsComponents.register( 'regen-thumbnails', RegenThumbnailsTool );
