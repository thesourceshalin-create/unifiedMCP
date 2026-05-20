import type { NextConfig } from 'next'

const config: NextConfig = {
  webpack(cfg) {
    cfg.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    }
    return cfg
  },
}

export default config
