const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

module.exports = {
    entry: {
        'admin': './src/assets/admin/src/index.tsx',
        'frontend': './src/assets/frontend/src/index.js',
    },
    output: {
        path: path.resolve(__dirname, isDevelopment ? 'dist/dev' : 'dist/prod'),
        filename: 'assets/js/[name].js',
        clean: true,
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
                    'sass-loader',
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
                    filename: 'assets/images/[name][ext]',
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
            filename: 'assets/css/[name].css',
        }),
        new CopyWebpackPlugin({
            patterns: [
                // Copy PHP files
                {
                    from: 'src/**/*.php',
                    to: '[path][name][ext]',
                    transformPath: (targetPath) => {
                        return targetPath.replace('src/', '');
                    },
                },
                // Copy plugin root files
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
                // Copy static assets
                {
                    from: 'src/public/assets/**/*',
                    to: 'public/assets/[name][ext]',
                },
                // Copy languages
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
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all',
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