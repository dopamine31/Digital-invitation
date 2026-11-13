import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rasa Undangan",
    short_name: "Rasa",
    description: "Undangan digital & RSVP premium",
    start_url: "/app",
    display: "standalone",
    background_color: "#F7F5F1",
    theme_color: "#8B6A43",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
