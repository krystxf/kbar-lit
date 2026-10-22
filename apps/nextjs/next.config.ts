import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['kbar-lit', '@kbar-lit/example-actions'],
  ...(process.env.KBAR_STATIC_SITE === '1'
    ? { output: 'export', basePath: '/react', trailingSlash: true }
    : {}),
};
export default config;
