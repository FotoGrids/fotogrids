// Divi dependencies.
import { ModuleEditProps } from '@divi/module-library';
import {
  FormatBreakpointStateAttr,
  InternalAttrs,
  type Element,
  type Module,
} from '@divi/types';

export interface FotoGridsAlbumAttrs extends InternalAttrs {
  css?: Module.Css.GroupAttr<{ inner?: string }>;
  module?: {
    meta?: Element.Meta.Attributes;
    advanced?: {
      link?: Element.Advanced.Link.Attributes;
      htmlAttributes?: Element.Advanced.IdClasses.Attributes;
    };
    decoration?: Element.Decoration.PickedAttributes<
      'animation' |
      'background' |
      'border' |
      'boxShadow' |
      'disabledOn' |
      'filters' |
      'overflow' |
      'position' |
      'scroll' |
      'sizing' |
      'spacing' |
      'sticky' |
      'transform' |
      'transition' |
      'zIndex'
    >;
  };
  album?: {
    innerContent?: FormatBreakpointStateAttr<{ albumId?: string }>;
  };
  previewClickBehavior?: {
    innerContent?: FormatBreakpointStateAttr<{ enabled?: string }>;
  };
  previewPagination?: {
    innerContent?: FormatBreakpointStateAttr<{ enabled?: string }>;
  };
}

export type FotoGridsAlbumEditProps = ModuleEditProps<FotoGridsAlbumAttrs>;
