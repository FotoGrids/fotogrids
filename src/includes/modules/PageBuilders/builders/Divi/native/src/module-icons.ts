import { addFilter } from '@wordpress/hooks';
import {
  moduleGallery,
  moduleAlbum,
} from './icons';

// Add FotoGrids module icons to Divi's icon library.
addFilter('divi.iconLibrary.icon.map', 'fotogrids', (icons) => ({
  ...icons,
  [moduleGallery.name]: moduleGallery,
  [moduleAlbum.name]:   moduleAlbum,
}));
