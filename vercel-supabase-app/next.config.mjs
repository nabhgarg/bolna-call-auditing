/** @type {import('next').NextConfig} */

// Only these four screens may be framed, and only by the apex. Everything else
// in the app stays unframeable by default · no X-Frame-Options is set anywhere
// and no CSP applies elsewhere, so nothing here widens or replaces a policy.
//
// frame-ancestors is the modern control and the only one that takes a list;
// X-Frame-Options has no multi-origin form, which is exactly why we do not set
// it · a stray DENY/SAMEORIGIN from any layer would break the demo silently.
const FRAME_ANCESTORS = "frame-ancestors https://realloop.in https://www.realloop.in";
const embeddable = (source, has) => ({
  source,
  ...(has ? { has } : {}),
  headers: [{ key: "Content-Security-Policy", value: FRAME_ANCESTORS }]
});

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      embeddable("/portal/new-use-case"),
      embeddable("/portal/reliability"),
      embeddable("/transcribe"),
      embeddable("/marketplace/join"),
      // marketplace.realloop.in serves /marketplace/join from its root via the
      // host rewrite in middleware.ts · the browser asks for "/", so the header
      // has to match "/" as well, scoped to that host so the reviewer app's own
      // root (review.realloop.in and the default host) stays unframeable.
      embeddable("/", [{ type: "host", value: "marketplace.realloop.in" }])
    ];
  }
};

export default nextConfig;
