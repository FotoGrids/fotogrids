import React, { ReactElement } from 'react';
import {
  CssStyle,
  StyleContainer,
  StylesProps,
} from '@divi/module';
import metadata from './module.json';
import { FotoGridsGalleryAttrs } from './types';

const ModuleStyles = ({
  mode,
  state,
  noStyleTag,
  elements,
  attrs,
  orderClass,
}: StylesProps<FotoGridsGalleryAttrs>): ReactElement => (
  <StyleContainer mode={mode} state={state} noStyleTag={noStyleTag}>
    {elements.style({ attrName: 'module' })}
    <CssStyle
      selector={orderClass}
      attr={attrs.css}
      cssFields={metadata.customCssFields}
    />
  </StyleContainer>
);

export { ModuleStyles };
