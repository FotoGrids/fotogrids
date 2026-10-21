import { expect, type Locator, type Page } from '@playwright/test';
import { wpEval } from './roles';

/**
 * Easy / Advanced setup mode: the per-user preference, the switch in the
 * settings panel's docs strip, and the surfaces that depend on the mode.
 */

export type Mode = 'easy' | 'advanced';

export const USER_MODE_META = 'fotogrids_settings_mode';
export const TIP_DISMISSED_META = 'fotogrids_settings_mode_tip_dismissed';
export const SITE_MODE_OPTION = 'fotogrids_settings_mode';
export const TIP_OPTION = 'fotogrids_settings_mode_tip';

function userId( login: string ): string {
	return `get_user_by( 'login', ${ JSON.stringify( login ) } )->ID`;
}

/** A user meta value, or null when the row does not exist. */
export function userMeta( login: string, key: string ): string | null {
	const out = wpEval(
		`$id = ${ userId( login ) }; echo metadata_exists( 'user', $id, '${ key }' ) ? 'v:' . get_user_meta( $id, '${ key }', true ) : 'none';`
	).trim();
	return 'none' === out ? null : out.slice( 2 );
}

/** Set a user meta value, or delete it when `value` is null. */
export function setUserMeta( login: string, key: string, value: string | null ): void {
	wpEval(
		null === value
			? `delete_user_meta( ${ userId( login ) }, '${ key }' );`
			: `update_user_meta( ${ userId( login ) }, '${ key }', ${ JSON.stringify( value ) } );`
	);
}

/** The panel's Easy/Advanced switch. */
export class ModeSwitch {
	constructor( private readonly page: Page ) {}

	group(): Locator {
		return this.page
			.locator( '.fotogrids-settings-docs-strip__mode' )
			.getByRole( 'radiogroup', { name: 'Setup mode' } );
	}

	option( mode: Mode ): Locator {
		return this.group()
			.getByRole( 'radio' )
			.filter( { hasText: 'easy' === mode ? /^\s*Easy\s*$/ : /^\s*Advanced\s*$/ } );
	}

	async expectActive( mode: Mode ): Promise< void > {
		await expect( this.option( mode ) ).toHaveAttribute( 'aria-checked', 'true', {
			timeout: 20000,
		} );
	}

	/** Pick a mode and wait for the per-user preference write. */
	async choose( mode: Mode ): Promise< void > {
		const write = this.page.waitForResponse(
			( r ) =>
				'POST' === r.request().method() &&
				r.url().includes( 'admin-ajax.php' ) &&
				( r.request().postData() ?? '' ).includes( 'fotogrids_update_user_preference' )
		);
		await this.option( mode ).click();
		const response = await write;
		expect( ( await response.json() ).success ).toBe( true );
		await this.expectActive( mode );
	}
}

/** The upgrade tip, shown inside the shared fg-tooltip. */
export function tip( page: Page ): Locator {
	return page.locator( '#fg-tooltip' ).getByRole( 'dialog', { name: 'Settings are simpler now' } );
}

/** Any element saying settings were changed in Advanced editing mode. */
export function noticeText( page: Page ): Locator {
	return page.getByText( /changed in Advanced editing mode/ );
}

function escapeRegExp( text: string ): string {
	return text.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
}

/** A preset_group control, by its label. */
export function presetGroup( page: Page, label: string ): Locator {
	return page.locator( '.fotogrids-setting[data-fg-setting-type="preset_group"]' ).filter( {
		has: page.locator( '.fotogrids-setting__label', {
			hasText: new RegExp( `^\\s*${ escapeRegExp( label ) }\\s*$` ),
		} ),
	} );
}

/** One option of a preset_group control. */
export function presetOption( page: Page, group: string, option: string ): Locator {
	return presetGroup( page, group ).getByRole( 'button', { name: option, exact: true } );
}

/** The selected option(s) of a preset_group control. */
export function presetSelected( page: Page, group: string ): Locator {
	return presetGroup( page, group ).locator( '.fg-button-group__button.fg-is-active' );
}

/** The label of the tab the panel has open. */
export function activeTab( page: Page ): Locator {
	return page.locator( '.fotogrids-settings-tab.fg-is-active .fotogrids-settings-tab__label' );
}
