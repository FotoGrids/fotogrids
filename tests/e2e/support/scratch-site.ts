import { execFileSync, spawn, type ChildProcess } from 'child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'fs';
import { createServer } from 'net';
import { tmpdir } from 'os';
import path from 'path';

/**
 * A WordPress of its own, for a spec that has to wreck the site it runs on.
 *
 * Copies the core the harness downloaded, gives it a database and a `php -S`
 * server of its own, and installs a copy of the built plugin, so deleting the
 * plugin there cannot touch the shared site or the build every other spec uses.
 * Needs the ci-mode harness: a local MySQL and `.state/` from boot.sh.
 */

const HARNESS = path.resolve( 'tests/harness' );
const STATE = process.env.FG_HARNESS_STATE ?? path.join( HARNESS, '.state' );

export const ADMIN = { user: 'admin', pass: 'password' };

/** Whether this machine can build one. */
export function scratchSitesAvailable(): boolean {
	return 'ci' === process.env.FG_MODE && existsSync( path.join( STATE, 'wp', 'wp-settings.php' ) );
}

function mysqlArgs(): string[] {
	const args = [ '-u', process.env.FG_DB_USER ?? 'root' ];

	if ( process.env.FG_DB_SOCKET ) {
		args.push( `--socket=${ process.env.FG_DB_SOCKET }` );
	} else {
		args.push(
			`--host=${ process.env.FG_DB_HOST ?? '127.0.0.1' }`,
			`--port=${ process.env.FG_DB_PORT ?? '3306' }`
		);
	}

	if ( process.env.FG_DB_PASS ) {
		args.push( `--password=${ process.env.FG_DB_PASS }` );
	}

	return args;
}

function dbHost(): string {
	return process.env.FG_DB_SOCKET
		? `localhost:${ process.env.FG_DB_SOCKET }`
		: `${ process.env.FG_DB_HOST ?? '127.0.0.1' }:${ process.env.FG_DB_PORT ?? '3306' }`;
}

/** A port nothing is listening on, so a server left over from an earlier run is never reused. */
function freePort(): Promise< number > {
	return new Promise( ( resolve, reject ) => {
		const probe = createServer();
		probe.once( 'error', reject );
		probe.listen( 0, '127.0.0.1', () => {
			const address = probe.address();
			probe.close( () => resolve( 'object' === typeof address && address ? address.port : 0 ) );
		} );
	} );
}

export class ScratchSite {
	url = '';
	readonly dir: string;
	private readonly db: string;
	private server: ChildProcess | null = null;

	constructor( name: string ) {
		this.dir = mkdtempSync( path.join( tmpdir(), `fg-${ name }-` ) );
		this.db = `fg_e2e_${ name.replace( /\W/g, '_' ) }`;
	}

	/** Install WordPress, activate the plugin and start serving. */
	async create(): Promise< this > {
		this.url = `http://127.0.0.1:${ await freePort() }`;
		cpSync( path.join( STATE, 'wp' ), this.dir, { recursive: true } );
		rmSync( path.join( this.dir, 'wp-config.php' ), { force: true } );

		// The shared install's log came with the copy. Left there, every line
		// another test or an earlier session wrote counts as this site's.
		rmSync( path.join( this.dir, 'wp-content', 'debug.log' ), { force: true } );

		// The harness links the plugin into the shared build; a delete through
		// the link would remove the build itself.
		const plugin = path.join( this.dir, 'wp-content', 'plugins', 'fotogrids' );
		const build = realpathSync( path.join( STATE, 'wp', 'wp-content', 'plugins', 'fotogrids' ) );
		rmSync( plugin, { recursive: true, force: true } );
		cpSync( build, plugin, { recursive: true, dereference: true } );

		execFileSync( 'mysql', [
			...mysqlArgs(),
			'-e',
			`DROP DATABASE IF EXISTS \`${ this.db }\`; CREATE DATABASE \`${ this.db }\`;`,
		] );

		this.wp( 'config', 'create', '--force', `--dbname=${ this.db }`,
			`--dbuser=${ process.env.FG_DB_USER ?? 'root' }`,
			`--dbpass=${ process.env.FG_DB_PASS ?? '' }`,
			`--dbhost=${ dbHost() }`, '--skip-check' );
		this.wp( 'config', 'set', 'WP_DEBUG', 'true', '--raw' );
		this.wp( 'config', 'set', 'WP_DEBUG_LOG', 'true', '--raw' );
		this.wp( 'config', 'set', 'WP_DEBUG_DISPLAY', 'false', '--raw' );
		// No request spawned in the background while a spec moves plugin files.
		this.wp( 'config', 'set', 'DISABLE_WP_CRON', 'true', '--raw' );
		this.wp( 'core', 'install', `--url=${ this.url }`, '--title=FotoGrids scratch',
			`--admin_user=${ ADMIN.user }`, `--admin_password=${ ADMIN.pass }`,
			'--admin_email=test@example.com', '--skip-email' );
		this.wp( 'plugin', 'activate', 'fotogrids' );

		this.server = spawn( 'php', [ '-S', this.url.replace( 'http://', '' ), '-t', this.dir, path.join( HARNESS, 'router.php' ) ], {
			env: { ...process.env, PHP_CLI_SERVER_WORKERS: '4' },
			stdio: 'ignore',
		} );

		for ( let tries = 0; tries < 40; tries++ ) {
			try {
				const res = await fetch( `${ this.url }/wp-login.php` );
				if ( res.ok ) {
					return this;
				}
			} catch {
				// Not listening yet.
			}
			await new Promise( ( resolve ) => setTimeout( resolve, 250 ) );
		}

		throw new Error( `scratch site did not come up on ${ this.url }` );
	}

	/** Run wp-cli against this site and return stdout. */
	wp( ...args: string[] ): string {
		return execFileSync(
			'php',
			[ path.join( STATE, 'wp-cli.phar' ), `--path=${ this.dir }`, '--allow-root', ...args ],
			{ encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'pipe' ] }
		).trim();
	}

	/** Seed one of the harness fixture sets. */
	seed( set: string ): void {
		this.wp( 'eval-file', path.join( HARNESS, 'seed.php' ), `out=${ this.dir }.fixtures.json`, `only=${ set }` );
	}

	/** PHP errors the site logged, without deprecations from core or wp-cli. */
	phpErrors(): string[] {
		const file = path.join( this.dir, 'wp-content', 'debug.log' );

		return existsSync( file )
			? readFileSync( file, 'utf8' )
				.split( '\n' )
				.filter( ( line ) => /PHP (Notice|Warning|Fatal error)/.test( line ) )
			: [];
	}

	destroy(): void {
		this.server?.kill();

		try {
			execFileSync( 'mysql', [ ...mysqlArgs(), '-e', `DROP DATABASE IF EXISTS \`${ this.db }\`;` ] );
		} catch {
			// Already gone.
		}

		rmSync( this.dir, { recursive: true, force: true } );
		rmSync( `${ this.dir }.fixtures.json`, { force: true } );
	}
}
