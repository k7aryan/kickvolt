import type { MetadataRoute } from "next";

// Lets people "Add to Home Screen" and use Kickvolt like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kickvolt",
    short_name: "Kickvolt",
    description: "Live scores, tables, odds analysis and an AI football assistant.",
    start_url: "/",
    display: "standalone",
    background_color: "#050b08",
    theme_color: "#050b08",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
