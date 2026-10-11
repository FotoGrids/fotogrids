import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { storageStateFor, wpEval } from './support/roles';

test.use({ storageState: storageStateFor('administrator') });

/**
 * Tools > Migration > WordPress galleries, and its "If a gallery already
 * exists" choice.
 *
 * Serial: the scan reads every published post on the site, and the posts,
 * galleries and migration log this spec writes are removed afterwards.
 */

test.describe.configure({ mode: 'serial' });

const SCREEN = '/wp-admin/admin.php?page=fotogrids-tools&tool=migration';
const BLOCK = 'fg-e2e migration block';
const SHORTCODE = 'fg-e2e migration shortcode';
const ORIGIN = '_fotogrids_migration_origin';

let posts: number[] = [];
let log = '';

/** Galleries migrated from this spec's posts, Trash excluded. */
function migrated(): number {
	return Number(
		wpEval(
			`echo count( get_posts( array( 'post_type' => 'fotogrids_gallery', 'post_status' => 'any', 'fields' => 'ids', 'posts_per_page' => -1, 'meta_query' => array( array( 'key' => '${ORIGIN}', 'value' => array( ${posts
				.map((id) => `'wp-core:post:${id}:0'`)
				.join(', ')} ), 'compare' => 'IN' ) ) ) ) );`
		).trim()
	);
}

function removeGalleries(): void {
	wpEval(
		`foreach ( get_posts( array( 'post_type' => 'fotogrids_gallery', 'post_status' => array( 'any', 'trash' ), 'fields' => 'ids', 'posts_per_page' => -1, 'meta_key' => '${ORIGIN}' ) ) as $id ) { if ( 0 === strpos( get_post_meta( $id, '${ORIGIN}', true ), 'wp-core:post:' ) && in_array( (int) explode( ':', get_post_meta( $id, '${ORIGIN}', true ) )[2], array( ${posts.join(
			', '
		)} ), true ) ) { wp_delete_post( $id, true ); } }`
	);
}

/** Scan, then leave only this spec's two galleries selected. */
async function scan(page: Page): Promise<void> {
	await page.goto(SCREEN);
	await page
		.locator('.fg-migration__source-card', {
			hasText: 'WordPress galleries',
		})
		.click();
	await page.getByRole('button', { name: 'Scan galleries' }).click();
	await expect(page.locator('.fg-migration__preview')).toBeVisible();

	await page.getByRole('checkbox', { name: 'Select all galleries' }).click();
	await expect(
		page.getByRole('checkbox', { name: 'Select all galleries' })
	).not.toBeChecked();
	for (const title of [BLOCK, SHORTCODE]) {
		await page
			.getByRole('checkbox', { name: `Select ${title}`, exact: true })
			.click();
	}
}

/** Import the selection with a conflict mode and return the result line. */
async function runImport(
	page: Page,
	mode: 'Skip' | 'Duplicate'
): Promise<string> {
	await page.getByRole('radio', { name: mode }).click();
	await page.getByRole('button', { name: 'Import 2 galleries' }).click();

	const result = page.locator('.fg-migration__result-text');
	await expect(result).toBeVisible();

	return (await result.innerText()).trim();
}

test.beforeAll(() => {
	log = wpEval(
		`echo wp_json_encode( get_option( 'fotogrids_migration_log', null ) );`
	).trim();

	const ids = wpEval(
		`require_once ABSPATH . 'wp-admin/includes/image.php';
		$ids = array();
		foreach ( array( 'a', 'b', 'c', 'd' ) as $n ) {
			$file = wp_tempnam( 'fg-e2e-migration.jpg' );
			$im = imagecreatetruecolor( 40, 30 );
			imagejpeg( $im, $file );
			imagedestroy( $im );
			$up = wp_upload_bits( "fg-e2e-migration-$n.jpg", null, file_get_contents( $file ) );
			unlink( $file );
			$ids[] = wp_insert_attachment( array( 'post_mime_type' => 'image/jpeg', 'post_title' => "fg-e2e-migration-$n", 'post_status' => 'inherit' ), $up['file'] );
		}
		echo implode( ',', $ids );`
	)
		.trim()
		.split(',')
		.map(Number);

	const image = (id: number) =>
		`<!-- wp:image {"id":${id}} --><figure class="wp-block-image"><img class="wp-image-${id}"/></figure><!-- /wp:image -->`;
	const block = `<!-- wp:gallery {"linkTo":"none"} --><figure class="wp-block-gallery has-nested-images">${image(
		ids[0]
	)}${image(ids[1])}</figure><!-- /wp:gallery -->`;

	posts = [
		[BLOCK, block],
		[SHORTCODE, `[gallery ids="${ids[2]},${ids[3]}"]`],
	].map(([title, content]) =>
		Number(
			wpEval(
				`echo wp_insert_post( array( 'post_title' => ${JSON.stringify(title)}, 'post_content' => ${JSON.stringify(
					content
				)}, 'post_status' => 'publish' ) );`
			).trim()
		)
	);
	wpEval(
		`foreach ( array( ${ids.join(', ')} ) as $id ) { update_post_meta( $id, '_fg_e2e_migration', 1 ); }`
	);
});

test.afterAll(() => {
	removeGalleries();
	wpEval(
		`foreach ( array( ${posts.join(', ')} ) as $id ) { wp_delete_post( $id, true ); }
		foreach ( get_posts( array( 'post_type' => 'attachment', 'post_status' => 'any', 'fields' => 'ids', 'posts_per_page' => -1, 'meta_key' => '_fg_e2e_migration' ) ) as $id ) { wp_delete_attachment( $id, true ); }`
	);
	wpEval(
		'null' === log
			? `delete_option( 'fotogrids_migration_log' );`
			: `update_option( 'fotogrids_migration_log', json_decode( ${JSON.stringify(log)}, true ), false );`
	);
});

test(
	'Skip does not import the same WordPress galleries twice',
	{ tag: '@admin' },
	async ({ page }) => {
		await scan(page);
		expect(await runImport(page, 'Skip')).toBe(
			'2 galleries imported, 0 skipped.'
		);
		expect(migrated()).toBe(2);

		await scan(page);
		expect(await runImport(page, 'Skip')).toBe(
			'0 galleries imported, 2 skipped.'
		);
		expect(migrated()).toBe(2);
	}
);

test(
	'Duplicate imports them again, and a later Skip still recognises them',
	{ tag: '@admin' },
	async ({ page }) => {
		await scan(page);
		expect(await runImport(page, 'Duplicate')).toBe(
			'2 galleries imported, 0 skipped.'
		);
		expect(migrated()).toBe(4);

		await scan(page);
		expect(await runImport(page, 'Skip')).toBe(
			'0 galleries imported, 2 skipped.'
		);
		expect(migrated()).toBe(4);
	}
);

test(
	'a migrated gallery in the Trash is imported again under Skip',
	{ tag: '@admin' },
	async ({ page }) => {
		removeGalleries();

		await scan(page);
		expect(await runImport(page, 'Skip')).toBe(
			'2 galleries imported, 0 skipped.'
		);

		wpEval(
			`wp_trash_post( get_posts( array( 'post_type' => 'fotogrids_gallery', 'fields' => 'ids', 'posts_per_page' => 1, 'meta_key' => '${ORIGIN}', 'meta_value' => 'wp-core:post:${posts[0]}:0' ) )[0] );`
		);

		await scan(page);
		expect(await runImport(page, 'Skip')).toBe(
			'1 galleries imported, 1 skipped.'
		);
		expect(migrated()).toBe(2);
	}
);
