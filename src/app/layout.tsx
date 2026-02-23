import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "ArshBoost – Professional Game Boosting Service",
    template: "%s | ArshBoost",
  },
  description:
    "ArshBoost offers fast, safe, and professional game boosting services. Rank boost, win boost, duo boost – achieve your desired rank today.",
  keywords: ["game boosting", "rank boost", "elo boost", "win boost", "duo boost"],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://arshboost.com"
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "ArshBoost",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased font-sans bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
