<?php
/**
 * Extracting an uploaded ZIP archive into the Media Library.
 *
 * @package FotoGrids\REST\Media
 * @since   1.1.0
 */

namespace FotoGrids\REST\Media;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * ZIP Import Data Handler
 *
 * Backs the "From ZIP" import modal. The archive is unpacked into a temporary
 * folder, every entry is re-checked against the site's allowed image types,
 * and each surviving image goes through WordPress' own sideload pipeline so it
 * lands in the current month's uploads folder with its sizes generated. The
 * temporary folder and the archive itself are removed before the response is
 * returned.
 *
 * @since 1.1.0
 */
class Zip_Data {

	/**
	 * Maximum number of images imported from a single archive.
	 *
	 * @var int
	 */
	const MAX_FILES = 300;

	/**
	 * Maximum number of entries an archive may contain.
	 *
	 * @var int
	 */
	const MAX_ENTRIES = 5000;

	/**
	 * Maximum uncompressed size of an archive, in bytes.
	 *
	 * @var int
	 */
	const MAX_UNCOMPRESSED_BYTES = 1073741824;

	/**
	 * Maximum number of skipped entries reported back to the client.
	 *
	 * @var int
	 */
	const MAX_REPORTED_SKIPS = 100;

	/**
	 * Directory entries that never carry importable images.
	 *
	 * @var array<int, string>
	 */
	const IGNORED_DIRS = array( '__MACOSX' );

	/**
	 * Import every image found in an uploaded ZIP archive.
	 *
	 * @since 1.1.0
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function import( $request ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$files  = $request->get_file_params();
		$upload = isset( $files['file'] ) ? $files['file'] : null;

		if ( empty( $upload ) || empty( $upload['name'] ) ) {
			return new \WP_Error(
				'fotogrids_zip_missing',
				__( 'Choose a ZIP file to upload.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		if ( 'zip' !== strtolower( pathinfo( $upload['name'], PATHINFO_EXTENSION ) ) ) {
			return new \WP_Error(
				'fotogrids_zip_invalid',
				__( 'That file is not a ZIP archive.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		if ( 'direct' !== get_filesystem_method() ) {
			return new \WP_Error(
				'fotogrids_zip_filesystem',
				__( 'ZIP import needs direct file access, which this site does not allow.', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		if ( ! WP_Filesystem() ) {
			return new \WP_Error(
				'fotogrids_zip_filesystem',
				__( 'ZIP import needs direct file access, which this site does not allow.', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		self::purge_stale_dirs();

		$temp = self::temp_dir();

		if ( is_wp_error( $temp ) ) {
			return $temp;
		}

		try {
			$archive = self::stage_archive( $upload, $temp );

			if ( is_wp_error( $archive ) ) {
				return $archive;
			}

			$budget = self::check_budget( $archive );

			if ( is_wp_error( $budget ) ) {
				wp_delete_file( $archive );
				return $budget;
			}

			$extracted  = trailingslashit( $temp ) . 'extracted';
			$extraction = self::extract_images( $archive, $extracted );

			wp_delete_file( $archive );

			if ( is_wp_error( $extraction ) ) {
				return $extraction;
			}

			$result = self::sideload_images( $extracted, $extraction );

			if ( empty( $result['items'] ) && empty( $result['skipped'] ) ) {
				return new \WP_Error(
					'fotogrids_zip_empty',
					__( 'That archive does not contain any images.', 'fotogrids' ),
					array( 'status' => 400 )
				);
			}

			return rest_ensure_response( $result );
		} finally {
			self::remove_dir( $temp );
		}
	}

	/**
	 * Unpack an archive, writing only the entries that are allowed images.
	 *
	 * ZipArchive can extract a chosen subset, so every other entry - scripts,
	 * archives, anything unrecognised - is never written to disk at all. That
	 * matters because the extraction folder can, on a host where
	 * `get_temp_dir()` falls back to WP_CONTENT_DIR, sit inside the document
	 * root, where a `.htaccess` deny rule only covers Apache.
	 *
	 * Without ext/zip, `unzip_file()` handles the archive as before and the
	 * deny files written by protect_dir() are the remaining mitigation.
	 *
	 * @since 1.1.0
	 * @param string $archive Absolute path of the archive.
	 * @param string $dest    Absolute path to extract into.
	 * @return array<int, string>|\WP_Error Rejected entry names.
	 */
	private static function extract_images( $archive, $dest ) {
		if ( ! class_exists( '\ZipArchive' ) ) {
			return self::extract_with_core( $archive, $dest );
		}

		$zip = new \ZipArchive();

		if ( true !== $zip->open( $archive ) ) {
			return new \WP_Error(
				'fotogrids_zip_unreadable',
				__( 'That archive could not be read.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$wanted   = array();
		$rejected = array();

		for ( $index = 0; $index < $zip->numFiles; $index++ ) { // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- ZipArchive defines this property name.
			$name = $zip->getNameIndex( $index );

			if ( ! is_string( $name ) || '' === $name || '/' === substr( $name, -1 ) ) {
				continue;
			}

			if ( ! self::is_safe_entry_name( $name ) ) {
				continue;
			}

			if ( Folder_Data::is_allowed_image( $name ) ) {
				$wanted[] = $name;
			} else {
				$rejected[] = wp_basename( $name );
			}
		}

		if ( empty( $wanted ) ) {
			$zip->close();
			return $rejected;
		}

		if ( ! wp_mkdir_p( $dest ) ) {
			$zip->close();
			return new \WP_Error(
				'fotogrids_temp_dir_failed',
				__( 'A temporary folder for the import could not be created.', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		$extracted = $zip->extractTo( $dest, $wanted );

		$zip->close();

		if ( ! $extracted ) {
			return new \WP_Error(
				'fotogrids_zip_extract_failed',
				__( 'That archive could not be extracted.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		return $rejected;
	}

	/**
	 * Unpack an archive with core's unzip_file().
	 *
	 * @since 1.1.0
	 * @param string $archive Absolute path of the archive.
	 * @param string $dest    Absolute path to extract into.
	 * @return array<int, string>|\WP_Error Rejected entry names.
	 */
	private static function extract_with_core( $archive, $dest ) {
		$guard = self::budget_guard();

		add_filter( 'pre_unzip_file', $guard, 10, 5 );
		$unzipped = unzip_file( $archive, $dest );
		remove_filter( 'pre_unzip_file', $guard, 10 );

		if ( is_wp_error( $unzipped ) ) {
			return new \WP_Error(
				'fotogrids_zip_extract_failed',
				$unzipped->get_error_message(),
				array( 'status' => 400 )
			);
		}

		return array();
	}

	/**
	 * Whether an archive entry name is safe to extract.
	 *
	 * @since 1.1.0
	 * @param string $name Entry name as stored in the archive.
	 * @return bool
	 */
	private static function is_safe_entry_name( $name ) {
		$normalised = wp_normalize_path( $name );

		if ( 0 !== validate_file( $normalised ) ) {
			return false;
		}

		if ( 0 === strpos( $normalised, '/' ) || preg_match( '#^[A-Za-z]:#', $normalised ) ) {
			return false;
		}

		foreach ( explode( '/', $normalised ) as $segment ) {
			if ( '' === $segment || 0 === strpos( $segment, '.' ) ) {
				return false;
			}

			if ( in_array( $segment, self::IGNORED_DIRS, true ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Second budget gate, applied by core immediately before extraction.
	 *
	 * check_budget() needs ext/zip; this covers the PclZip fallback path too.
	 * The hook is WP 6.4+, so on older releases add_filter() simply never
	 * fires and check_budget() is the only gate.
	 *
	 * @since 1.1.0
	 * @return callable
	 */
	private static function budget_guard() {
		return static function ( $result, $file, $to, $needed_dirs, $required_space ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by the pre_unzip_file filter contract.
			// Core sizes the job as the uncompressed total plus 110% working
			// headroom, so the budget is scaled the same way to stay in step
			// with check_budget().
			if ( $required_space > self::MAX_UNCOMPRESSED_BYTES * 2.1 ) {
				return new \WP_Error(
					'fotogrids_zip_too_large',
					sprintf(
						/* translators: %s: maximum unpacked archive size, e.g. 1 GB. */
						__( 'That archive unpacks to more than %s. Split it into smaller archives.', 'fotogrids' ),
						size_format( self::MAX_UNCOMPRESSED_BYTES )
					),
					array( 'status' => 400 )
				);
			}

			return $result;
		};
	}

	/**
	 * Reject an archive whose contents exceed the import budget.
	 *
	 * unzip_file() writes every entry before anything is filtered, and core's
	 * own free-space comparison runs only under cron, so the entry count and
	 * uncompressed size are checked here before extraction starts.
	 *
	 * @since 1.1.0
	 * @param string $archive Absolute path of the uploaded archive.
	 * @return true|\WP_Error
	 */
	private static function check_budget( $archive ) {
		if ( ! class_exists( '\ZipArchive' ) ) {
			return true;
		}

		$zip = new \ZipArchive();

		if ( true !== $zip->open( $archive ) ) {
			return new \WP_Error(
				'fotogrids_zip_unreadable',
				__( 'That archive could not be read.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$entries = $zip->numFiles; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- ZipArchive defines this property name.
		$total   = 0;

		for ( $index = 0; $index < $entries; $index++ ) {
			$stat = $zip->statIndex( $index );

			if ( is_array( $stat ) && isset( $stat['size'] ) ) {
				$total += (int) $stat['size'];
			}

			if ( $total > self::MAX_UNCOMPRESSED_BYTES ) {
				break;
			}
		}

		$zip->close();

		if ( $entries > self::MAX_ENTRIES ) {
			return new \WP_Error(
				'fotogrids_zip_too_many_entries',
				sprintf(
					/* translators: %s: maximum number of entries allowed in one archive. */
					__( 'That archive holds more than %s files. Split it into smaller archives.', 'fotogrids' ),
					number_format_i18n( self::MAX_ENTRIES )
				),
				array( 'status' => 400 )
			);
		}

		if ( $total > self::MAX_UNCOMPRESSED_BYTES ) {
			return new \WP_Error(
				'fotogrids_zip_too_large',
				sprintf(
					/* translators: %s: maximum unpacked archive size, e.g. 1 GB. */
					__( 'That archive unpacks to more than %s. Split it into smaller archives.', 'fotogrids' ),
					size_format( self::MAX_UNCOMPRESSED_BYTES )
				),
				array( 'status' => 400 )
			);
		}

		return true;
	}

	/**
	 * Move the uploaded archive into the temporary folder.
	 *
	 * The archive never touches a web-served path: `upload_dir` is redirected
	 * for the duration of the call so WordPress writes it straight into the
	 * temporary folder.
	 *
	 * @since 1.1.0
	 * @param array  $upload Entry from the request's file params.
	 * @param string $temp   Absolute path of the temporary folder.
	 * @return string|\WP_Error Absolute path of the stored archive.
	 */
	private static function stage_archive( $upload, $temp ) {
		$redirect = static function ( $dirs ) use ( $temp ) {
			$dirs['path']   = untrailingslashit( $temp );
			$dirs['url']    = '';
			$dirs['subdir'] = '';
			return $dirs;
		};

		add_filter( 'upload_dir', $redirect );

		$moved = wp_handle_upload(
			$upload,
			array(
				'test_form' => false,
				'mimes'     => array( 'zip' => 'application/zip' ),
			)
		);

		remove_filter( 'upload_dir', $redirect );

		if ( ! empty( $moved['error'] ) || empty( $moved['file'] ) ) {
			return new \WP_Error(
				'fotogrids_zip_upload_failed',
				! empty( $moved['error'] ) ? $moved['error'] : __( 'The ZIP file could not be uploaded.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		return $moved['file'];
	}

	/**
	 * Remove extraction folders left behind by an interrupted import.
	 *
	 * @since 1.1.0
	 * @return void
	 */
	private static function purge_stale_dirs() {
		$root = self::temp_root();

		if ( ! is_dir( $root ) || ! is_readable( $root ) ) {
			return;
		}

		$cutoff  = time() - HOUR_IN_SECONDS;
		$entries = scandir( $root );

		foreach ( (array) $entries as $entry ) {
			if ( '.' === $entry || '..' === $entry ) {
				continue;
			}

			$path = $root . $entry;

			if ( is_link( $path ) ) {
				continue;
			}

			if ( is_dir( $path ) && filemtime( $path ) < $cutoff ) {
				self::remove_dir( $path );
			}
		}
	}

	/**
	 * Parent folder holding every extraction folder.
	 *
	 * get_temp_dir() resolves outside the document root on virtually every
	 * host; the deny files exist for the rare fallback where it does not.
	 *
	 * @since 1.1.0
	 * @return string Trailing-slashed absolute path.
	 */
	private static function temp_root() {
		return trailingslashit( get_temp_dir() ) . Folder_Data::TEMP_DIR_NAME . '/';
	}

	/**
	 * Create a private temporary folder for one extraction.
	 *
	 * @since 1.1.0
	 * @return string|\WP_Error Absolute path to the new folder.
	 */
	private static function temp_dir() {
		$root = self::temp_root();

		if ( ! wp_mkdir_p( $root ) ) {
			return new \WP_Error(
				'fotogrids_temp_dir_failed',
				__( 'A temporary folder for the import could not be created.', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		self::protect_dir( $root );

		$dir = $root . wp_generate_password( 12, false );

		if ( ! wp_mkdir_p( $dir ) ) {
			return new \WP_Error(
				'fotogrids_temp_dir_failed',
				__( 'A temporary folder for the import could not be created.', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		return $dir;
	}

	/**
	 * Write deny files so the folder is not served even if it sits in the
	 * document root.
	 *
	 * @since 1.1.0
	 * @param string $root Trailing-slashed absolute path.
	 * @return void
	 */
	private static function protect_dir( $root ) {
		global $wp_filesystem;

		if ( ! $wp_filesystem instanceof \WP_Filesystem_Base ) {
			return;
		}

		if ( ! $wp_filesystem->exists( $root . '.htaccess' ) ) {
			$rules = "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n"
				. "<IfModule !mod_authz_core.c>\nOrder allow,deny\nDeny from all\n</IfModule>\n";
			$wp_filesystem->put_contents( $root . '.htaccess', $rules );
		}

		if ( ! $wp_filesystem->exists( $root . 'web.config' ) ) {
			$config = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
				. "<configuration><system.webServer><authorization>\n"
				. "<deny users=\"*\" />\n"
				. "</authorization></system.webServer></configuration>\n";
			$wp_filesystem->put_contents( $root . 'web.config', $config );
		}

		if ( ! $wp_filesystem->exists( $root . 'index.php' ) ) {
			$wp_filesystem->put_contents( $root . 'index.php', "<?php\n// Silence is golden.\n" );
		}
	}

	/**
	 * Walk an extracted archive and sideload every allowed image it holds.
	 *
	 * @since 1.1.0
	 * @param string             $root     Absolute path of the extraction folder.
	 * @param array<int, string> $rejected Entry names refused before extraction.
	 * @return array{items: array, skipped: array}
	 */
	private static function sideload_images( $root, $rejected = array() ) {
		$items    = array();
		$skipped  = array();
		$attempts = 0;
		$found    = self::collect_files( $root );
		$rejected = array_merge( (array) $rejected, $found['rejected'] );

		foreach ( $found['images'] as $path ) {
			if ( $attempts >= self::MAX_FILES ) {
				$skipped[] = array(
					'path'   => wp_basename( $path ),
					'reason' => sprintf(
						/* translators: %d: maximum number of images imported from one archive. */
						__( 'Only the first %d images were imported.', 'fotogrids' ),
						self::MAX_FILES
					),
				);
				break;
			}

			++$attempts;

			$attachment_id = media_handle_sideload(
				array(
					'name'     => wp_basename( $path ),
					'tmp_name' => $path,
					'error'    => 0,
					'size'     => (int) filesize( $path ),
				),
				0
			);

			if ( is_wp_error( $attachment_id ) ) {
				$skipped[] = array(
					'path'   => wp_basename( $path ),
					'reason' => $attachment_id->get_error_message(),
				);
				continue;
			}

			$item = Media_Items::to_item( $attachment_id );

			if ( $item ) {
				$items[] = $item;
			}
		}

		foreach ( $rejected as $name ) {
			$skipped[] = array(
				'path'   => $name,
				'reason' => __( 'Not a supported image file.', 'fotogrids' ),
			);
		}

		$total_skipped = count( $skipped );

		if ( $total_skipped > self::MAX_REPORTED_SKIPS ) {
			$skipped   = array_slice( $skipped, 0, self::MAX_REPORTED_SKIPS );
			$skipped[] = array(
				'path'   => '',
				'reason' => sprintf(
					/* translators: %s: number of further skipped entries. */
					__( 'and %s more', 'fotogrids' ),
					number_format_i18n( $total_skipped - self::MAX_REPORTED_SKIPS )
				),
			);
		}

		return array(
			'items'   => $items,
			'skipped' => $skipped,
		);
	}

	/**
	 * Separate an extracted tree into importable images and rejected entries.
	 *
	 * Every candidate is resolved with realpath() and dropped unless it is
	 * still inside the extraction folder, so an archive carrying traversal or
	 * symlink entries cannot reach the rest of the filesystem.
	 *
	 * @since 1.1.0
	 * @param string $root Absolute path of the extraction folder.
	 * @return array{images: array<int, string>, rejected: array<int, string>}
	 */
	private static function collect_files( $root ) {
		$images   = array();
		$rejected = array();
		$real     = realpath( $root );

		if ( false === $real || ! is_dir( $real ) ) {
			return array(
				'images'   => $images,
				'rejected' => $rejected,
			);
		}

		$boundary = wp_normalize_path( $real );

		$iterator = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator( $root, \FilesystemIterator::SKIP_DOTS ),
			\RecursiveIteratorIterator::SELF_FIRST,
			\RecursiveIteratorIterator::CATCH_GET_CHILD
		);

		foreach ( $iterator as $file ) {
			if ( $file->isDir() ) {
				continue;
			}

			$name = $file->getFilename();

			if ( 0 === strpos( $name, '.' ) ) {
				continue;
			}

			if ( self::is_ignored_path( $file->getPathname(), $boundary ) ) {
				continue;
			}

			$resolved = realpath( $file->getPathname() );

			if ( false === $resolved || 0 !== strpos( wp_normalize_path( $resolved ), trailingslashit( $boundary ) ) ) {
				continue;
			}

			if ( ! Folder_Data::is_allowed_image( $resolved ) ) {
				$rejected[] = $name;
				continue;
			}

			$images[] = $resolved;
		}

		sort( $images, SORT_NATURAL | SORT_FLAG_CASE );

		return array(
			'images'   => $images,
			'rejected' => $rejected,
		);
	}

	/**
	 * Whether a path sits under a directory the importer never reads.
	 *
	 * @since 1.1.0
	 * @param string $path     Absolute file path.
	 * @param string $boundary Absolute path of the extraction folder.
	 * @return bool
	 */
	private static function is_ignored_path( $path, $boundary ) {
		$relative = trim( str_replace( $boundary, '', wp_normalize_path( $path ) ), '/' );

		foreach ( explode( '/', $relative ) as $segment ) {
			if ( in_array( $segment, self::IGNORED_DIRS, true ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Delete a folder and everything inside it.
	 *
	 * @since 1.1.0
	 * @param string $dir Absolute folder path.
	 * @return void
	 */
	private static function remove_dir( $dir ) {
		global $wp_filesystem;

		if ( $wp_filesystem instanceof \WP_Filesystem_Base ) {
			$wp_filesystem->delete( $dir, true );
		}
	}
}
