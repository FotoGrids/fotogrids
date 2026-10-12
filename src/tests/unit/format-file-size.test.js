/**
 * Shared admin file-size formatter.
 */
import { formatFileSize } from '@/admin/src/utils/format-file-size';

describe( 'formatFileSize', () => {
	it( 'returns nothing for an unknown or empty size', () => {
		expect( formatFileSize( 0 ) ).toBe( '' );
		expect( formatFileSize( undefined ) ).toBe( '' );
		expect( formatFileSize( null ) ).toBe( '' );
	} );

	it( 'keeps whole bytes', () => {
		expect( formatFileSize( 1 ) ).toBe( '1 B' );
		expect( formatFileSize( 1023 ) ).toBe( '1023 B' );
	} );

	it( 'shows one decimal below ten units', () => {
		expect( formatFileSize( 1024 ) ).toBe( '1.0 KB' );
		expect( formatFileSize( 1536 ) ).toBe( '1.5 KB' );
		expect( formatFileSize( 3 * 1048576 ) ).toBe( '3.0 MB' );
	} );

	it( 'rounds to a whole number from ten units up', () => {
		expect( formatFileSize( 15360 ) ).toBe( '15 KB' );
		expect( formatFileSize( 1023 * 1024 ) ).toBe( '1023 KB' );
		expect( formatFileSize( 250 * 1048576 ) ).toBe( '250 MB' );
	} );

	it( 'stops at gigabytes', () => {
		expect( formatFileSize( 5 * 1073741824 ) ).toBe( '5.0 GB' );
		expect( formatFileSize( 2048 * 1073741824 ) ).toBe( '2048 GB' );
	} );
} );
