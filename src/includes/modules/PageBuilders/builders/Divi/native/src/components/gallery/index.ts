import {
  type Metadata,
  type ModuleLibrary,
} from '@divi/types';
import { FotoGridsGalleryEdit } from './edit';
import metadata from './module.json';
import { FotoGridsGalleryAttrs } from './types';
import { placeholderContent } from './placeholder-content';

import './module.scss';

export const fotogridsGalleryModule: ModuleLibrary.Module.RegisterDefinition<FotoGridsGalleryAttrs> = {
  metadata: metadata as Metadata.Values<FotoGridsGalleryAttrs>,
  placeholderContent,
  renderers: {
    edit: FotoGridsGalleryEdit,
  },
};
