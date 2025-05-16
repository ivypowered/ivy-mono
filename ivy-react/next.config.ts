import type { NextConfig } from "next";
import { addWidgetCompilation } from "./widget-compiler";

const nextConfig: NextConfig = addWidgetCompilation({
    webpack: (config) => {
        config.externals.push("pino-pretty");
        return config;
    },
});

export default nextConfig;
