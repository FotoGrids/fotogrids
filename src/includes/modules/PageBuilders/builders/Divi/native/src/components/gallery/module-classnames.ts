import { type Module } from '@divi/types';
import { elementClassnames } from '@divi/module';

import { FotoGridsGalleryAttrs } from './types';

/**
 * Module classnames function for the FotoGrids Gallery module.
 */
export const moduleClassnames = ({
	classnamesInstance,
	attrs,
}: Module.Classnames.ModuleClassnamesParams<FotoGridsGalleryAttrs>): void => {
	classnamesInstance.add(
		elementClassnames({
			attrs: attrs?.module?.decoration ?? {},
		})
	);
};
