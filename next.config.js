/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APPWRITE_ENDPOINT: process.env.APPWRITE_ENDPOINT,
    NEXT_PUBLIC_APPWRITE_PROJECT_ID: process.env.APPWRITE_PROJECT_ID,
  },
};

module.exports = nextConfig;
