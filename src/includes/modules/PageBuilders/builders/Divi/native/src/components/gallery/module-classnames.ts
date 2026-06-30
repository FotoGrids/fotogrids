import {
  type Module,
} from '@divi/types';
import { elementClassnames } from '@divi/module';

/**
 * Module classnames function for the FotoGrids Gallery module.
 */
export const moduleClassnames = ({
  classnamesInstance,
  attrs,
}: Module.Classnames.ModuleClassnamesParams<any>): void => {
  classnamesInstance.add(
    elementClassnames({
      attrs: attrs?.module?.decoration ?? {},
    })
  );
};
