import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import ThemeProvider from "@/components/ThemeProvider";
import SWRegister from "@/components/SWRegister";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});
const serif = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Haru",
  description: "A calm plan for the day.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Haru",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2e6e8e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=localStorage.getItem('haru.palette')||'b';var t=localStorage.getItem('haru.theme')||'system';document.documentElement.dataset.palette=p;if(t!=='system')document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.palette='b';}`,
          }}
        />
      </head>
      <body>
        <SWRegister />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
