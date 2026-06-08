import React, { Fragment, ReactElement } from 'react';
import { ModuleScriptDataProps } from '@divi/module';
import { FotoGridsAlbumAttrs } from './types';

export const ModuleScriptData = ({
  elements,
}: ModuleScriptDataProps<FotoGridsAlbumAttrs>): ReactElement => (
  <Fragment>
    {elements.scriptData({ attrName: 'module' })}
  </Fragment>
);
