/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep already-visited routes in the client router cache so tab-switching
    // is instant; they revalidate in the background. Mutations still bust it
    // via revalidatePath().
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
