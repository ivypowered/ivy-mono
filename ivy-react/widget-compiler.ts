import { resolve } from "path";
import * as webpack from "webpack";
import type { NextConfig } from "next";
import { WebpackConfigContext } from "next/dist/server/config-shared";

type Webpack = typeof webpack;

interface PublicRuntimeConfig {
    PUBLIC_BASE_URL: string;
    [key: string]: string | number | boolean | object;
}

class WidgetCompilerPlugin {
    private webpack: Webpack;
    private buildConfig: webpack.Configuration;

    constructor(
        publicRuntimeConfig: PublicRuntimeConfig,
        webpackConfig: webpack.Configuration,
        webpack: Webpack,
    ) {
        this.webpack = webpack;

        // Setup widget compilation config
        this.buildConfig = {
            ...webpackConfig,
            resolve: {
                ...webpackConfig.resolve,
                alias: {
                    ...Object.fromEntries(
                        Object.entries(
                            (webpackConfig.resolve?.alias as Record<
                                string,
                                string
                            >) || {},
                        ).filter(([key]) => key !== "next"),
                    ),
                    "next/config": resolve(__dirname, "getConfigFront.js"),
                },
            },
            optimization: {
                ...webpackConfig.optimization,
                runtimeChunk: false,
                splitChunks: {
                    cacheGroups: {
                        index: {
                            name: "index",
                            priority: 0,
                            chunks: "async",
                            enforce: true,
                        },
                        vendors: {
                            name: "vendors",
                            priority: 1,
                            test: /[\\/]node_modules[\\/]/,
                            chunks: "async",
                            reuseExistingChunk: true,
                        },
                    },
                },
            },
            entry: {
                index: "./app/index.tsx",
            },
            output: {
                ...webpackConfig.output,
                publicPath: `${publicRuntimeConfig.PUBLIC_BASE_URL}/_next/`,
                uniqueName: "embeddable-widget",
                filename: "static/widget/[name].js",
            },
            plugins: [
                ...(webpackConfig.plugins || []).filter(
                    (p) => p && p.constructor.name !== "DefinePlugin",
                ),
                new webpack.DefinePlugin({
                    ...((
                        (webpackConfig.plugins || []).find(
                            (p) => p && p.constructor.name === "DefinePlugin",
                        ) as webpack.DefinePlugin
                    )?.definitions || {}),
                    PUBLIC_RUNTIME_CONFIG: JSON.stringify(publicRuntimeConfig),
                }),
            ],
        };
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.beforeRun.tapPromise("Widget compiler", () =>
            this.compileWidget(),
        );
    }

    compileWidget(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log("   Building widget from app/index.tsx");

            const compilation = this.webpack.webpack(this.buildConfig);
            compilation.run((err: Error | null, stats?: webpack.Stats) => {
                if (err || (stats?.hasErrors() ?? false)) {
                    console.log(stats?.toString({ colors: true }) || err);
                    console.log(
                        " \x1b[31m\x1b[1m✗\x1b[0m Widget compilation failed",
                    );
                    return reject(new Error("Widget build failed"));
                }

                // Only show minimal stats output to match Next.js style
                if (stats) {
                    // Filter out most of the webpack output to just show essential info
                    const outputOptions = {
                        colors: true,
                        chunks: false,
                        modules: false,
                        entrypoints: false,
                        assets: false,
                    };
                    console.log(stats.toString(outputOptions));
                }
                console.log(" \x1b[32m\x1b[1m✓\x1b[0m Exported widget");
                resolve();
            });
        });
    }
}

const addWidgetCompilation = (nextConfig: NextConfig): NextConfig => {
    const publicRuntimeConfig =
        (nextConfig.publicRuntimeConfig as PublicRuntimeConfig) || {
            PUBLIC_BASE_URL: "",
        };

    return {
        ...nextConfig,
        webpack: (
            webpackConfig: webpack.Configuration,
            { isServer, webpack }: WebpackConfigContext,
        ) => {
            // Apply custom webpack config if provided
            if (typeof nextConfig.webpack === "function") {
                webpackConfig = nextConfig.webpack(webpackConfig, {
                    isServer,
                    webpack,
                } as WebpackConfigContext);
            }

            // Only compile widget during client-side build
            if (isServer) return webpackConfig;

            return {
                ...webpackConfig,
                plugins: [
                    ...(webpackConfig.plugins || []),
                    new WidgetCompilerPlugin(
                        publicRuntimeConfig,
                        webpackConfig,
                        webpack,
                    ),
                ],
            };
        },
    };
};

export { addWidgetCompilation };
