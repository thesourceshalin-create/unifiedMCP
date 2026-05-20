/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
  webpack(cfg) {
    cfg.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    }
    return cfg
  },
}

export default config
