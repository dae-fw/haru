import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Haru",
    short_name: "Haru",
    description: "A calm plan for the day.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f4f5",
    theme_color: "#2e6e8e",
    icons: [
      {
        src:
          "data:image/svg+xml," +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="112" fill="#2e6e8e"/><text x="50%" y="54%" font-family="Georgia,serif" font-size="300" fill="#fff" text-anchor="middle" dominant-baseline="middle">H</text></svg>`,
          ),
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
