import fs from 'fs';
import path from 'path';
import {
	GALLERY_POST_TYPE,
	ALBUM_POST_TYPE,
	toPostType,
} from '../../../assets/admin/src/utils/post-types';

const phpSource = fs.readFileSync(
	path.resolve(__dirname, '../../../includes/class-post-types.php'),
	'utf8'
);

const phpConstant = (name) => {
	const match = phpSource.match(
		new RegExp(`const\\s+${name}\\s*=\\s*'([^']+)'\\s*;`)
	);
	return match ? match[1] : null;
};

describe('post types', () => {
	it('match the Post_Types constants in PHP', () => {
		expect(GALLERY_POST_TYPE).toBe(phpConstant('GALLERY'));
		expect(ALBUM_POST_TYPE).toBe(phpConstant('ALBUM'));
	});

	it('maps a collection kind to its post type', () => {
		expect(toPostType('gallery')).toBe(GALLERY_POST_TYPE);
		expect(toPostType('album')).toBe(ALBUM_POST_TYPE);
	});
});
