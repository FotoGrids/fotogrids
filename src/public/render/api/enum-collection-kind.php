<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Identifies what kind of collection is being rendered.
 *
 * GALLERY — a normal gallery of attachments. The default; every render
 * before the album refactor was implicitly this.
 *
 * ALBUM — an album rendering its child galleries as items. The "items"
 * in the render context are gallery summaries, not attachments. The
 * same Grid / Justified / Masonry layouts apply; the same Captions /
 * Border / Shadow / Hover decorators apply. Click-behaviour decorators
 * specific to attachments (Lightbox, Direct_Link, External_Link) opt
 * out via supports(); two album-specific click-behaviour decorators
 * (Album_To_View_Page, Album_To_Gallery_Ajax) opt in.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
enum Collection_Kind: string {
	case GALLERY = 'gallery';
	case ALBUM   = 'album';
}
