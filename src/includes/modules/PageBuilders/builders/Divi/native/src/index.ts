import { omit } from 'lodash';

import { addAction } from '@wordpress/hooks';

import { registerModule } from '@divi/module-library';

import { fotogridsGalleryModule } from './components/gallery';
import { fotogridsAlbumModule } from './components/album';

import './module-icons';

declare global {
  interface Window {
    fotogridsPbDivi?: {
      galleryOptions?: Record<string, { label: string }>;
      albumOptions?: Record<string, { label: string }>;
      [k: string]: any;
    };
  }
}

/**
 * Inject live select options (passed from PHP via window.fotogridsPbDivi)
 * into a module's metadata before registration. The VB `divi/select`
 * reads options from this metadata, and the static module.json ships them
 * empty, so we patch them in here.
 */
const withOptions = (
  moduleDef: any,
  attrKey: 'gallery' | 'album',
  options?: Record<string, { label: string }>,
): any => {
  if (!options) {
    return moduleDef;
  }
  try {
    const item = moduleDef?.metadata?.attributes?.[attrKey]?.settings?.innerContent?.item;
    if (item?.component?.props) {
      item.component.props.options = options;
    }
  } catch (e) {
    // non-fatal — leave options empty if shape differs
  }
  return moduleDef;
};

let didRegister = false;

/**
 * Register both native modules with Divi's module library. Idempotent:
 * safe to call from both the registration action and the immediate path
 * below (whichever fires first wins; the other is a no-op).
 */
const register = (): void => {
  if (didRegister) {
    return;
  }
  const cfg = window.fotogridsPbDivi || {};
  const gallery = withOptions(fotogridsGalleryModule, 'gallery', cfg.galleryOptions);
  const album = withOptions(fotogridsAlbumModule, 'album', cfg.albumOptions);

  registerModule(gallery.metadata, omit(gallery, 'metadata'));
  registerModule(album.metadata, omit(album, 'metadata'));
  didRegister = true;
};

// The module-library store fires this action once it's ready to accept
// registrations. If the store is already initialised by the time this
// bundle runs, the action has already fired, so we also attempt an
// immediate registration — `register()` is idempotent, so at most one of
// the two paths actually registers.
addAction('divi.moduleLibrary.registerModuleLibraryStore.after', 'fotogrids', register);
register();
