/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

// Rspack (Config.setRspack(true)) is intentionally left off: on Remotion 4.0.523
// with @remotion/tailwind-v4 it finishes bundling without emitting bundle.js,
// which makes `remotion compositions` / `render` fail with ENOENT on bundle.js.
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.overrideBundlerConfig(enableTailwind);
