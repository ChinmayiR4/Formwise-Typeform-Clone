import type { NextConfig } from "next";

/**
 * The frontend is a fully static export (`out/`) so it can be hosted on
 * Cloudflare Pages. All data comes from the FastAPI backend at runtime.
 *
 * Public form links look like /to/<slug>. In production Cloudflare rewrites
 * /to/* -> /to (see public/_redirects) and the page reads the slug from the URL.
 * In `next dev` the same rewrite is provided below.
 */
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  output: isDev ? undefined : "export",
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(isDev
    ? {
        async rewrites() {
          return [{ source: "/to/:slug", destination: "/to" }];
        },
      }
    : {}),
};

export default nextConfig;
