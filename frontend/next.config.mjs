/** @type {import('next').NextConfig} */
const config = {
  async headers() {
    return [
      {
        // Browsers must always fetch the latest service worker so a new deployment takes over.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default config;
