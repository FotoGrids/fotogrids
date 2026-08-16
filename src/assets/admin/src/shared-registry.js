/**
 * FotoGrids shared-components registry.
 *
 * Exposes the shared admin UI primitives at window.FotoGridsAdmin.shared so
 * extension bundles (e.g. the Pro plugin's License page) can render with the
 * same components without bundling their own copies. Loaded with the admin
 * bundle on every FotoGrids admin page.
 */

import Icon from './components/shared/Icon';
import Button from './components/shared/Button/Button';
import ButtonGroup from './components/shared/Button/ButtonGroup';
import { fgGoUrl } from './utils/go-url';

window.FotoGridsAdmin = window.FotoGridsAdmin || {};
window.FotoGridsAdmin.shared = {
	Icon,
	Button,
	ButtonGroup,
	fgGoUrl,
};
