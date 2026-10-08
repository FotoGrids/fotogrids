import { type Module } from '@divi/types';
import { elementClassnames } from '@divi/module';

import { FotoGridsAlbumAttrs } from './types';

/**
 * Module classnames function for the FotoGrids Album module.
 */
export const moduleClassnames = ({
	classnamesInstance,
	attrs,
}: Module.Classnames.ModuleClassnamesParams<FotoGridsAlbumAttrs>): void => {
	classnamesInstance.add(
		elementClassnames({
			attrs: attrs?.module?.decoration ?? {},
		})
	);
};
