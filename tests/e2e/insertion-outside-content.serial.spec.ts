import { test, expect } from './support/test';
import { adopt, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { storageStateFor, wpCli, wpEval } from './support/roles';

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

/**
 * INS-21. A broken gallery in a block theme footer shows an editor the same
 * styled error box as one in the post content.
 */
test.describe('signed in as an administrator', () => {
	test.use({ storageState: storageStateFor('administrator') });

	test(
		'INS-21: a missing gallery in a block theme footer shows a styled error box',
		{ tag: '@layout' },
		async ({ page }) => {
			const content = Buffer.from(SHORTCODE_BLOCK(987654)).toString(
				'base64'
			);

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
				await page.goto(plainPost());

				const error = page.locator('.fotogrids-error');
				await expect(error).toHaveCount(1);
				await expect(error).toContainText('987654');
				await expect(error).toHaveCSS(
					'background-color',
					'rgb(255, 235, 232)'
				);
			} finally {
				wpEval(`wp_delete_post( ${part}, true );`);
			}
		}
	);
});

/** A must-use plugin for one row, removed afterwards. */
function withMuPlugin(code: string): () => void {
	const file = path.join(
		process.env.WP_PATH ?? '',
		'wp-content',
		'mu-plugins',
		`fg-e2e-ins21-${process.pid}.php`
	);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, `<?php\n${code}\n`);
	return () => rmSync(file, { force: true });
}

/**
 * INS-21. WordPress does not run shortcodes in a term description; a site that
 * turns them on gets a working gallery on the category archive.
 */
test(
	'INS-21: a gallery in a category description works on the archive once the site runs shortcodes there',
	{ tag: '@layout' },
	async ({ page }) => {
		const id = lightboxGallery();
		const term = JSON.parse(
			wpEval(
				`$t = wp_insert_term( 'Gallery category ' . wp_generate_password( 6, false ), 'category', array( 'description' => '<p>Before.</p>[fotogrids_gallery id="${id}"]<p>After.</p>' ) );
				$p = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'In the category', 'post_content' => '<p>Text.</p>', 'post_category' => array( $t['term_id'] ) ) );
				echo wp_json_encode( array( 'id' => $t['term_id'], 'post' => $p, 'url' => get_term_link( $t['term_id'] ) ) );`
			).trim()
		);
		adopt(term.post);
		const remove = withMuPlugin(
			"add_filter( 'term_description', 'do_shortcode' );"
		);

		try {
			await worksOn(page, term.url, id);
			await expect(page.getByText('Before.')).toBeVisible();
		} finally {
			remove();
			wpEval(`wp_delete_term( ${term.id}, 'category' );`);
		}
	}
);

/**
 * INS-21. A post whose content is a gallery leaves neither the shortcode nor
 * any gallery markup in its automatic excerpt.
 */
test(
	'INS-21: the automatic excerpt of a gallery post carries no shortcode and no gallery',
	{ tag: '@layout' },
	async () => {
		const id = lightboxGallery();
		const excerpt = wpEval(
			`$p = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'Gallery post', 'post_content' => '<p>Words before.</p>[fotogrids_gallery id="${id}"]<p>Words after.</p>' ) );
			update_post_meta( $p, '_fg_scoped', 1 );
			echo get_the_excerpt( $p );`
		).trim();

		expect(excerpt).toContain('Words before.');
		expect(excerpt).toContain('Words after.');
		expect(excerpt).not.toContain('fotogrids_gallery');
		expect(excerpt).not.toMatch(/fotogrids-collection|data-fg-/);
	}
);
