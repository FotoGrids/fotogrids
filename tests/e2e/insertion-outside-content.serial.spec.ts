import { test, expect } from './support/test';
import { adopt, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import { execFileSync } from 'child_process';
import { wpCli, wpEval } from './support/roles';

/**
 * A gallery that is not in the post's content: in a block theme's footer
 * template part, and in a classic theme's widget area. The page's own content
 * has no gallery, so nothing about the post tells the plugin one is coming.
 *
 * Serial: each row changes the site's footer or its theme and widgets.
 */

test.describe.configure({ mode: 'serial' });

const CLASSIC_THEME = 'twentytwentyone';

/** Install the classic theme when the site does not ship it. */
function ensureClassicTheme(): void {
	const installed = execFileSync(wpCli(), ['theme', 'list', '--field=name'], {
		encoding: 'utf8',
	}).split('\n');
	if (!installed.includes(CLASSIC_THEME)) {
		execFileSync(wpCli(), ['theme', 'install', CLASSIC_THEME], {
			encoding: 'utf8',
		});
	}
}

const SHORTCODE_BLOCK = (id: number) =>
	`<!-- wp:shortcode -->[fotogrids_gallery id="${id}"]<!-- /wp:shortcode -->`;

/** A published post with no gallery in it. */
function plainPost(): string {
	const id = Number(
		wpEval(
			`echo wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'Plain', 'post_content' => '<p>Nothing to see here.</p>' ) );`
		).trim()
	);
	adopt(id);
	return wpEval(`echo get_permalink( ${id} );`).trim();
}

function lightboxGallery(): number {
	return galleryPage(
		{ layout: 'grid', item_click_behavior: 'lightbox' },
		fixture<number[]>('F-small', 'items').slice(0, 3)
	).id;
}

async function worksOn(
	page: import('@playwright/test').Page,
	url: string,
	id: number
) {
	await page.goto(url);

	const gallery = new GalleryRender(page, id);
	await gallery.waitFor();
	await expect(gallery.items()).toHaveCount(3);
	expect(
		await page.evaluate(
			() => typeof (window as { fotogrids?: unknown }).fotogrids
		),
		'the runtime is missing'
	).toBe('object');

	await new Lightbox(page).openFrom(gallery);
}

/**
 * INS-18, INS-19. The block theme's footer, saved as a template part, carries
 * the gallery; the post is plain.
 */
test(
	'INS-19: a gallery in a block theme footer renders and works on a plain post',
	{ tag: '@layout' },
	async ({ page }) => {
		const id = lightboxGallery();
		const content = Buffer.from(SHORTCODE_BLOCK(id)).toString('base64');

		const part = Number(
			wpEval(
				`$id = wp_insert_post( array( 'post_type' => 'wp_template_part', 'post_name' => 'footer', 'post_title' => 'Footer', 'post_status' => 'publish', 'post_content' => base64_decode( '${content}' ) ) );
				wp_set_object_terms( $id, get_stylesheet(), 'wp_theme' );
				wp_set_object_terms( $id, 'footer', 'wp_template_part_area' );
				echo $id;`
			).trim()
		);

		try {
			expect(wpEval('echo wp_is_block_theme() ? 1 : 0;').trim()).toBe(
				'1'
			);
			await worksOn(page, plainPost(), id);
		} finally {
			wpEval(`wp_delete_post( ${part}, true );`);
		}
	}
);

/**
 * INS-20. A classic theme's footer widget area carries the gallery in a
 * Shortcode block widget; the post is plain.
 */
test(
	'INS-20: a gallery in a classic theme widget area renders and works on a plain post',
	{ tag: '@layout' },
	async ({ page }) => {
		const id = lightboxGallery();
		const content = Buffer.from(SHORTCODE_BLOCK(id)).toString('base64');

		const saved = wpEval(
			`echo wp_json_encode( array( 'theme' => get_stylesheet(), 'sidebars' => get_option( 'sidebars_widgets' ), 'blocks' => get_option( 'widget_block' ) ) );`
		).trim();
		const savedB64 = Buffer.from(saved).toString('base64');

		ensureClassicTheme();
		wpEval(
			`switch_theme( '${CLASSIC_THEME}' );
			update_option( 'widget_block', array( 2 => array( 'content' => base64_decode( '${content}' ) ), '_multiwidget' => 1 ) );
			$sidebars = get_option( 'sidebars_widgets', array() );
			$sidebars['sidebar-1'] = array( 'block-2' );
			update_option( 'sidebars_widgets', $sidebars );`
		);

		try {
			expect(wpEval('echo get_stylesheet();').trim()).toBe(CLASSIC_THEME);
			expect(
				wpEval('echo wp_get_theme()->exists() ? 1 : 0;').trim()
			).toBe('1');
			expect(wpEval('echo wp_is_block_theme() ? 1 : 0;').trim()).toBe(
				'0'
			);
			await worksOn(page, plainPost(), id);
		} finally {
			wpEval(
				`$saved = json_decode( base64_decode( '${savedB64}' ), true );
				switch_theme( $saved['theme'] );
				update_option( 'sidebars_widgets', $saved['sidebars'] );
				if ( false === $saved['blocks'] ) { delete_option( 'widget_block' ); } else { update_option( 'widget_block', $saved['blocks'] ); }`
			);
		}
	}
);
