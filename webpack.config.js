const path = require('path');
const fs = require('fs');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

const ENTRY_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.scss'];

/**
 * Auto-discover per-tool entries.
 *
 * Convention: each tool lives at `src/includes/tools/<id>/` and exposes
 * its entry asset(s) as `assets/<id>.{js,jsx,ts,tsx,scss}`. Files in the
 * tool's `assets/` folder whose basename does NOT match `<id>` (e.g. React
 * component files like `ImportExportTool.jsx`) are treated as helpers and
 * imported by the entry - not built as standalone entries.
 *
 * Each match produces an entry named `tool-<id>` and is routed to
 * `dist/includes/tools/<id>/assets/<id>.{js,css}` by the output/CSS
 * filename callbacks below.
 */
function discoverToolEntries() {
    const entries = {};
    const toolsRoot = path.resolve(__dirname, 'src/includes/tools');
    if (!fs.existsSync(toolsRoot)) return entries;

    for (const toolId of fs.readdirSync(toolsRoot)) {
        const assetsDir = path.join(toolsRoot, toolId, 'assets');
        if (!fs.statSync(path.join(toolsRoot, toolId)).isDirectory()) continue;
        if (!fs.existsSync(assetsDir)) continue;

        for (const ext of ENTRY_EXTENSIONS) {
            const entryFile = path.join(assetsDir, toolId + ext);
            if (fs.existsSync(entryFile)) {
                entries[`tool-${toolId}`] = './' + path.relative(__dirname, entryFile).replace(/\\/g, '/');
                break; // first match wins; JS takes precedence over SCSS by ENTRY_EXTENSIONS order
            }
        }
    }
    return entries;
}

/**
 * Auto-discover per-module entries.
 *
 * Convention: each module lives at `src/includes/modules/<Name>/` and
 * exposes its entry assets at `assets/src/<surface>.{js,jsx,ts,tsx,scss}`.
 * Every top-level file in `assets/src/` is an entry. Helper files belong
 * in subfolders (`assets/src/components/`, `assets/src/utils/`, …).
 *
 * Each match produces an entry named `module-<Name>-<surface>` and is
 * routed to `dist/includes/modules/<Name>/assets/<surface>.{js,css}` by
 * the output/CSS filename callbacks below.
 *
 * If a code entry (.js/.jsx/.ts/.tsx) and an SCSS entry share the same
 * `<surface>` name, the SCSS file is treated as styles for the code
 * entry - the code file is expected to `import './<surface>.scss'`,
 * which causes MiniCssExtractPlugin to emit the CSS alongside the code
 * bundle. A standalone SCSS entry is only registered when there is no
 * matching code file.
 */
function discoverModuleEntries() {
    const entries = {};
    const modulesRoot = path.resolve(__dirname, 'src/includes/modules');
    if (!fs.existsSync(modulesRoot)) return entries;

    const codeExts = new Set(['.js', '.jsx', '.ts', '.tsx']);

    for (const moduleName of fs.readdirSync(modulesRoot)) {
        const srcDir = path.join(modulesRoot, moduleName, 'assets', 'src');
        if (!fs.statSync(path.join(modulesRoot, moduleName)).isDirectory()) continue;
        if (!fs.existsSync(srcDir)) continue;

        const files = fs.readdirSync(srcDir).filter((f) =>
            fs.statSync(path.join(srcDir, f)).isFile()
        );

        // Surface = filename without extension. Collect code files first so we
        // know which surfaces already have a code entry; SCSS files for those
        // surfaces are skipped (the code entry imports them).
        const codeSurfaces = new Set(
            files
                .filter((f) => codeExts.has(path.extname(f)))
                .map((f) => path.basename(f, path.extname(f)))
        );

        for (const file of files) {
            const ext = path.extname(file);
            const surface = path.basename(file, ext);
            const isCode = codeExts.has(ext);
            const isStyle = ext === '.scss';

            if (!isCode && !isStyle) continue;
            if (isStyle && codeSurfaces.has(surface)) continue; // styles imported by sibling code entry

            const entryName = `module-${moduleName}-${surface}`;
            const rel = './' + path.relative(__dirname, path.join(srcDir, file)).replace(/\\/g, '/');
            entries[entryName] = rel;
        }
    }
    return entries;
}

module.exports = {
    entry: {
        'admin': './src/assets/admin/src/index.js',
        'metabox': './src/assets/admin/src/metabox.js',
        'fotogrids-runtime': './src/public/render/internal/runtime/runtime.js',
        'deep-linking': './src/assets/frontend/src/deep-linking.js',
        'fg-tooltip': './src/public/render/fg-tooltip/fg-tooltip.js',
        'loading-icon': './src/public/render/features/loading-icon/loading-icon.js',
        'loading-icon-styles': './src/public/render/features/loading-icon/loading-icon.scss',
        'lightbox': './src/public/render/features/lightbox/lightbox.js',
        'lightbox-styles': './src/public/render/features/lightbox/lightbox.scss',
        'filter-ui': './src/public/render/filters/features/ui/filter-ui.js',
        'filter-ui-styles': './src/public/render/filters/features/ui/filter-ui.scss',
        'sharing': './src/public/render/decorators/sharing/sharing.js',
        'password-gate': './src/public/render/gates/password/password-gate.js',
        'lazy-load': './src/public/render/features/lazy-load/lazy-load.js',
        'stats': './src/public/render/features/stats/stats.js',
        'album-to-gallery-ajax': './src/public/render/decorators/album-to-gallery-ajax/album-to-gallery-ajax.js',
        'collection-header': './src/public/render/features/collection-header/collection-header.js',
        'pagination-core': './src/public/render/features/pagination/pagination-core.js',
        'endless-scroll': './src/public/render/features/pagination/endless-scroll/endless-scroll.js',
        'load-more': './src/public/render/features/pagination/load-more/load-more.js',
        'page-buttons': './src/public/render/features/pagination/page-buttons/page-buttons.js',
        'collection-state-manager': './src/assets/admin/src/collection-state-manager.js',
        'ajax-save': './src/assets/admin/src/ajax-save.js',
        'album-assignment': './src/assets/admin/src/album-assignment.js',
        'album-galleries': './src/assets/admin/src/album-galleries.js',
        'global-modal-init': './src/assets/admin/src/global-modal-init.js',
        'admin-header': './src/assets/admin/src/admin-header.js',
        'upgrade-modal': './src/assets/admin/src/styles/upgrade-modal.scss',
        'codemirror-init': './src/assets/admin/src/codemirror-init.js',
        'dashboard-widget': './src/assets/admin/src/dashboard-widget.js',
        'dashboard-widget-styles': './src/assets/admin/src/styles/dashboard-widget.scss',
        'toast-init': './src/assets/admin/src/toast-init.js',
        'shortcode-column-init': './src/assets/admin/src/shortcode-column-init.js',
        'ui-state-manager': './src/assets/admin/src/utils/ui-state-manager.js',
        // Per-tool and per-module entries are discovered automatically from the
        // filesystem. The routing for these chunks lives in the output.filename
        // and MiniCssExtractPlugin.filename callbacks below.
        ...discoverToolEntries(),
        ...discoverModuleEntries(),
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        // Route tool-* and module-* entries to their feature folder; everything
        // else to assets/js/.
        filename: (pathData) => {
            const name = pathData.chunk.name;
            if (name && name.startsWith('tool-')) {
                const toolId = name.slice('tool-'.length);
                return `includes/tools/${toolId}/assets/${toolId}.js`;
            }
            if (name && name.startsWith('module-')) {
                const rest = name.slice('module-'.length);   // '<Name>-<surface>'
                const dash = rest.indexOf('-');
                const moduleName = rest.slice(0, dash);       // '<Name>'
                const asset = rest.slice(dash + 1);           // '<surface>'
                return `includes/modules/${moduleName}/assets/${asset}.js`;
            }
            return 'assets/js/[name].js';
        },
        publicPath: 'auto',
        clean: false, // managed manually; 'true' causes EPERM in sandboxed environments
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.jsx'],
        alias: {
            '@': path.resolve(__dirname, 'src/assets'),
        },
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react'],
                    },
                },
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    {
                        loader: 'sass-loader',
                        options: {
                            api: 'modern',
                            implementation: require('sass'),
                        },
                    },
                ],
            },
            {
                test: /\.css$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                ],
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/items/[name][ext]',
                },
            },
            {
                test: /\.(woff|woff2|eot|ttf|otf)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/fonts/[name][ext]',
                },
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            // Route tool-* and module-* CSS to their feature folder; everything
            // else to assets/css/.
            filename: (pathData) => {
                const name = pathData.chunk.name;
                if (name && name.startsWith('tool-')) {
                    const toolId = name.slice('tool-'.length);
                    return `includes/tools/${toolId}/assets/${toolId}.css`;
                }
                if (name && name.startsWith('module-')) {
                    const rest = name.slice('module-'.length);
                    const dash = rest.indexOf('-');
                    const moduleName = rest.slice(0, dash);
                    const asset = rest.slice(dash + 1);
                    return `includes/modules/${moduleName}/assets/${asset}.css`;
                }
                return 'assets/css/[name].css';
            },
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'src/**/*.php',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    from: 'src/includes/rest/templates/templates/**/*.json',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    from: 'src/config/**/*.json',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    from: 'src/fotogrids.php',
                    to: 'fotogrids.php',
                },
                {
                    from: 'src/readme.txt',
                    to: 'readme.txt',
                },
                {
                    from: 'src/index.php',
                    to: 'index.php',
                },
                {
                    from: 'src/uninstall.php',
                    to: 'uninstall.php',
                },
                {
                    // Freemius SDK non-PHP assets (CSS, JS, fonts, images, languages).
                    from: 'src/freemius/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                    globOptions: {
                        ignore: ['**/*.php'],
                    },
                },
                {
                    from: 'src/assets/admin/plain/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                    filter: (resourcePath) => {
                        return !resourcePath.includes('ajax-save.js') && !resourcePath.includes('meta-boxes.js');
                    },
                    transform(content, absoluteFilename) {
                        if (isProduction && absoluteFilename.endsWith('.js')) {
                            if (!content || content.length === 0) {
                                console.warn('Empty content for', absoluteFilename);
                                return content;
                            }

                            const terser = require('terser');

                            try {
                                const sourceCode = Buffer.isBuffer(content) ? content.toString('utf8') : String(content);

                                if (!sourceCode.trim()) {
                                    console.warn('Empty source code for', absoluteFilename);
                                    return content;
                                }

                                const result = terser.minify(sourceCode, {
                                    compress: {
                                        drop_console: true,
                                        drop_debugger: true,
                                        pure_funcs: ['console.log', 'console.info', 'console.debug'],
                                    },
                                    mangle: {
                                        toplevel: false,
                                        reserved: ['jQuery', '$', 'wp', 'ajaxurl'],
                                        properties: false,
                                    },
                                    format: {
                                        comments: false,
                                    },
                                });

                                if (result.error) {
                                    console.warn('Terser error for', absoluteFilename, ':', result.error);
                                    return content;
                                }

                                if (!result.code) {
                                    console.info('No minified code generated for', absoluteFilename);
                                    return content;
                                }

                                return Buffer.from(result.code, 'utf8');
                            } catch (error) {
                                console.warn('Failed to minify', absoluteFilename, ':', error.message);
                                return content;
                            }
                        }
                        return content;
                    },
                },
                {
                    from: 'src/assets/admin/images/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    from: 'src/public/assets/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    from: 'src/public/render/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                    globOptions: {
                        // .php and .scss are excluded because webpack handles them (PHP via
                        // the php copy patterns above; SCSS via MiniCssExtractPlugin).
                        // fg-tooltip.js and runtime.js are also excluded because they're
                        // webpack entry points — the built output lands in assets/js/.
                        ignore: [
                            '**/*.php',
                            '**/*.scss',
                            '**/*.md',
                            '**/fg-tooltip/fg-tooltip.js',
                            '**/internal/runtime/runtime.js',
                            '**/decorators/sharing/sharing.js',
                            '**/gates/password/password-gate.js',
                            '**/features/lazy-load/lazy-load.js',
                            '**/features/stats/stats.js',
                            '**/decorators/album-to-gallery-ajax/album-to-gallery-ajax.js',
                            '**/features/collection-header/collection-header.js',
                            '**/features/pagination/pagination-core.js',
                            '**/features/pagination/endless-scroll/endless-scroll.js',
                            '**/features/pagination/load-more/load-more.js',
                            '**/features/pagination/page-buttons/page-buttons.js',
                        ],
                    },
                },
                {
                    from: 'src/languages/**/*',
                    to: 'languages/[name][ext]',
                    noErrorOnMissing: true,
                },
            ],
        }),
    ],
    externals: {
        'react': 'React',
        'react-dom': 'ReactDOM',
        '@wordpress/element': 'wp.element',
        '@wordpress/components': 'wp.components',
        '@wordpress/data': 'wp.data',
        '@wordpress/api-fetch': 'wp.apiFetch',
        '@wordpress/i18n': 'wp.i18n',
        '@wordpress/blocks': 'wp.blocks',
        '@wordpress/media-utils': 'wp.mediaUtils',
        'jquery': 'jQuery',
    },
    optimization: {
        minimize: isProduction,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    compress: {
                        drop_console: isProduction,
                        drop_debugger: true,
                        pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
                    },
                    mangle: {
                        toplevel: false,
                        reserved: ['jQuery', '$', 'wp', 'ajaxurl'],
                        properties: false,
                    },
                    format: {
                        comments: false,
                    },
                },
                extractComments: false,
            }),
        ],
        splitChunks: {
            // Exclude metabox, per-tool, and per-module bundles from chunk
            // splitting. These are loaded standalone by WordPress with no
            // awareness of sibling chunk files; splitting them causes a silent
            // runtime failure.
            chunks: (chunk) =>
                chunk.name !== 'metabox' &&
                !chunk.name?.startsWith('tool-') &&
                !chunk.name?.startsWith('module-'),
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: (chunk) =>
                        chunk.name !== 'metabox' &&
                        !chunk.name?.startsWith('tool-') &&
                        !chunk.name?.startsWith('module-'),
                },
            },
        },
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    mode: isProduction ? 'production' : 'development',
    watch: isDevelopment,
    watchOptions: {
        ignored: /node_modules/,
        poll: 1000,
    },
};
