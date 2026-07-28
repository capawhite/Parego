import { withSentryConfig } from "@sentry/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        pathname: "/v1/**",
      },
    ],
  },
}

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim()

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: sentryAuthToken,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Don't fail production builds when source-map upload isn't configured
  sourcemaps: {
    disable: !sentryAuthToken,
  },
})
