import {
  type Metadata,
  type ModuleLibrary,
} from '@divi/types';
import { FotoGridsAlbumEdit } from './edit';
import metadata from './module.json';
import { FotoGridsAlbumAttrs } from './types';
import { placeholderContent } from './placeholder-content';

import './module.scss';

export const fotogridsAlbumModule: ModuleLibrary.Module.RegisterDefinition<FotoGridsAlbumAttrs> = {
  metadata: metadata as Metadata.Values<FotoGridsAlbumAttrs>,
  placeholderContent,
  renderers: {
    edit: FotoGridsAlbumEdit,
  },
};
