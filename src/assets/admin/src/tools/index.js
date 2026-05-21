/**
 * FotoGrids Tools — built-in component registrations.
 *
 * Importing this file registers all Free built-in tool components into
 * FotoGridsToolsComponents. ToolsPage imports this before first render.
 *
 * To add a new built-in Free tool:
 *   1. Create tools/<your-tool>/index.js with the registration call.
 *   2. Import it here.
 *
 * Pro tools register from their own JS bundle via window.FotoGridsToolsComponents.
 */
import './regen-thumbnails/index.js';
import './import-export/index.js';
