import React, { Fragment, ReactElement } from 'react';
import { ModuleScriptDataProps } from '@divi/module';
import { FotoGridsGalleryAttrs } from './types';

export const ModuleScriptData = ({
  elements,
}: ModuleScriptDataProps<FotoGridsGalleryAttrs>): ReactElement => (
  <Fragment>
    {elements.scriptData({ attrName: 'module' })}
  </Fragment>
);
