/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  buildExcludes: [/middleware-manifest\.json$/],
  cacheId: 'v2',
  disable: process.env.NODE_ENV === 'development',
  // Exclude all /api/ routes from SW caching — they are auth-gated and user-specific.
  // Caching them risks serving stale data from a previous user's session.
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'google-fonts-webfonts', expiration: { maxEntries: 4, maxAgeSeconds: 31536000 } },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'google-fonts-stylesheets', expiration: { maxEntries: 4, maxAgeSeconds: 604800 } },
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font\.css)$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-font-assets', expiration: { maxEntries: 4, maxAgeSeconds: 604800 } },
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-image-assets', expiration: { maxEntries: 64, maxAgeSeconds: 86400 } },
    },
    {
      urlPattern: /\/_next\/image\?url=.+$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'next-image', expiration: { maxEntries: 64, maxAgeSeconds: 86400 } },
    },
    {
      urlPattern: /\.(?:js)$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-js-assets', expiration: { maxEntries: 32, maxAgeSeconds: 86400 } },
    },
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-style-assets', expiration: { maxEntries: 32, maxAgeSeconds: 86400 } },
    },
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'next-data', expiration: { maxEntries: 32, maxAgeSeconds: 86400 } },
    },
    {
      urlPattern: ({ url }) => {
        if (url.origin !== self.location.origin) return false;
        return !url.pathname.startsWith('/api/');
      },
      handler: 'NetworkFirst',
      options: { cacheName: 'others', networkTimeoutSeconds: 10, expiration: { maxEntries: 32, maxAgeSeconds: 86400 } },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
