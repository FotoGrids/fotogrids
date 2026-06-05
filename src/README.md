# FotoGrids WordPress Plugin

A modern, freemium WordPress gallery plugin with Pro features for photographers, agencies, and e-commerce stores.

## Features

### Free Version

-   ✅ Unlimited galleries and albums
-   ✅ Basic templates (Grid, Masonry, Justified)
-   ✅ Lightbox with keyboard navigation
-   ✅ Lazy loading and responsive design
-   ✅ Statistics tracking (views/shares)
-   ✅ Shortcodes and Gutenberg blocks
-   ✅ Drag & drop item reordering
-   ✅ Per-item metadata (captions, tags, people, location)

### Pro Features

-   🔒 **Starter Pro**: Advanced templates, page builder widgets, hover effects
-   🔒 **Expert Pro**: Video galleries, EXIF data, advanced filtering, dynamic galleries
-   🔒 **Commerce Pro**: WooCommerce integration, watermarking, white labeling

## Installation

1. Upload the plugin files to `/wp-content/plugins/fotogrids/`
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Go to **FotoGrids** in the admin menu to start creating galleries

## Development Setup

### Prerequisites

-   Node.js 18+ and npm 8+
-   WordPress 5.8+ with PHP 8.0+
-   MySQL 5.7+ (for JSON column support)

### Getting Started

```bash
# Navigate to source directory
cd src/

# Install dependencies
npm install

# Build for development (with watch mode)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure

```
Plugin/
├── fotogrids.php           # Main plugin file
├── readme.txt              # WordPress plugin readme
├── uninstall.php           # Uninstall handler
├── index.php               # Security file
└── src/                    # Source files
    ├── admin/              # Admin interface PHP classes
    │   ├── class-admin-init.php
    │   └── screens/        # Individual admin screen files
    ├── includes/           # Core PHP classes
    │   ├── class-activator.php
    │   ├── class-post-types.php
    │   ├── class-rest.php
    │   └── ...
    ├── public/             # Frontend PHP classes
    │   ├── public-render.php
    │   ├── templates/      # Gallery template files
    │   └── assets/         # Compiled CSS/JS
    ├── assets/             # Source files
    │   ├── admin/src/      # React/TypeScript admin components
    │   └── frontend/src/   # Vanilla JS frontend code
    ├── build/              # Compiled assets (auto-generated)
    ├── languages/          # Translation files
    ├── tests/              # Unit and integration tests
    ├── package.json        # Node.js dependencies
    ├── webpack.config.js   # Build configuration
    ├── tsconfig.json       # TypeScript configuration
    └── README.md           # Development documentation
```

## Usage

### Creating a Gallery

1. Go to **FotoGrids > Galleries** in your WordPress admin
2. Click **Add New Gallery**
3. Add a title and description
4. Click **Add from Media Library** to select items
5. Drag and drop to reorder items
6. Configure gallery settings (layout, columns, etc.)
7. Publish the gallery
8. Copy the shortcode and paste it in your post or page

### Shortcode Usage

```php
// Basic gallery
[fotogrids_gallery id="123"]

// Gallery with custom settings
[fotogrids_gallery id="123" template="masonry" cols="4" lazy="true"]

// Album display
[fotogrids_album id="456"]
```

### Gutenberg Block

Search for "FotoGrids Gallery" in the block editor and configure the settings in the sidebar.

## API Endpoints

The plugin provides REST API endpoints for frontend functionality:

-   `GET /wp-json/fotogrids/v1/gallery/{id}` - Get gallery data
-   `GET /wp-json/fotogrids/v1/album/{id}` - Get album data
-   `GET /wp-json/fotogrids/v1/items` - Query items with filters
-   `POST /wp-json/fotogrids/v1/stats/view` - Track gallery/item views
-   `POST /wp-json/fotogrids/v1/stats/share` - Track social shares
-   `GET /wp-json/fotogrids/v1/templates` - Get available templates

## Database Schema

### Custom Tables

-   `wp_fotogrids_item_meta` - Per-item metadata and gallery associations
-   `wp_fotogrids_statistics` - View and share statistics
-   `wp_fotogrids_licenses` - Pro license management

### Custom Post Types

-   `fotogrids_gallery` - Gallery posts
-   `fotogrids_album` - Album posts

### Taxonomies

-   `fotogrids_tag` - Item tags
-   `fotogrids_person` - People tagging
-   `fotogrids_location` - Location tagging

## Hooks and Filters

### Actions

-   `fotogrids/actions/item/added` - Fired when an item is added to a gallery
-   `fotogrids/actions/item/removed` - Fired when an item is removed
-   `fotogrids/actions/item/meta/updated` - Fired when item metadata is updated
-   `fotogrids/actions/gallery/reordered` - Fired when gallery items are reordered
-   `fotogrids/actions/share/tracked` - Fired when a share is tracked

### Filters

-   `fotogrids/features/layouts/available` - Modify available gallery layouts
-   `fotogrids/settings/sanitize` - Override settings sanitization
-   `fotogrids/features/pro/can_use` - Per-feature Pro gating
-   `fotogrids/permissions/check` - Layer additional permission rules

Full hook catalogue: `Plugin/src/includes/hooks/`.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes in the `src/` directory
4. Run tests and linting (`npm run lint && npm run test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the GPL v2 or later - see the [LICENSE](LICENSE) file for details.

## Support

-   Documentation: [https://fotogrids.com/docs](https://fotogrids.com/docs)
-   Support Forum: [https://wordpress.org/support/plugin/fotogrids](https://wordpress.org/support/plugin/fotogrids)
-   Pro Support: [https://fotogrids.com/support](https://fotogrids.com/support)

## Changelog

### 0.1.0 - Initial Release

-   Core gallery and album functionality
-   Basic templates (Grid, Masonry, Justified)
-   Lightbox with keyboard navigation
-   Statistics tracking
-   Shortcodes and Gutenberg blocks
-   Admin interface with React components
-   REST API for frontend functionality
