import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Rasa Undangan — Undangan Digital & RSVP Premium", template: "%s · Rasa Undangan" },
  description: "Platform SaaS undangan digital, RSVP, dan check-in yang sepenuhnya dapat dikustomisasi untuk setiap acara.",
  applicationName: "Rasa Undangan",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, themeColor: "#8B6A43",
};

const themeScript = `(function(){try{var t=localStorage.getItem('rasa-theme');if(t==='dark'||(t===null&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Manrope:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Jost:wght@300;400;500&family=Amiri:wght@400;700&family=Lato:wght@300;400;700&family=Cinzel:wght@400;600;700&family=Noto+Sans:wght@300;400;500;600&family=Caveat:wght@400;600;700&family=Nunito:wght@300;400;600&family=Bodoni+Moda:opsz,wght@6..96,400;6..96,700&family=Space+Grotesk:wght@300;400;500;700&family=Italiana&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
