import pkg from "@/package.json";

/** App version + short commit, shown in Settings. */
export const APP_VERSION = pkg.version;

export const BUILD_SHA = (
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_COMMIT_SHA ??
  ""
).slice(0, 7);

export const VERSION_LABEL = BUILD_SHA
  ? `v${APP_VERSION} · ${BUILD_SHA}`
  : `v${APP_VERSION}`;
