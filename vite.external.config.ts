import defineConfig from "./node_modules/@universe-platform/ui-cli/vite/vite.external.config.ts";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

defineConfig.plugins.push(cssInjectedByJsPlugin());

defineConfig.build.minify = false;

export default defineConfig;
