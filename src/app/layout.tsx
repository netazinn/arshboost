import type { Metadata } from "next";
import { Inter, Roboto, Roboto_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { JsonLd, buildWebSiteSchema, buildOrganizationSchema } from "@/components/shared/JsonLd";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { GlobalBanner } from "@/components/shared/GlobalBanner";
import { MaintenanceScreen } from "@/components/shared/MaintenanceScreen";
import { getGlobalSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data/profiles";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-roboto",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto-mono",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch settings and current user in parallel — both are needed for the
  // maintenance gate. getGlobalSettings() uses the service-role client and
  // never throws; createClient() reads cookies but cannot set them here.
  const [{ is_maintenance_mode }, supabase] = await Promise.all([
    getGlobalSettings(),
    createClient(),
  ])

  let isAdmin = false
  if (is_maintenance_mode) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const profile = await getProfile(user.id)
      isAdmin = profile?.role === 'admin'
    }
  }

  return (
    <html lang="en" className={`${inter.variable} ${roboto.variable} ${robotoMono.variable}`} suppressHydrationWarning>
      <body className="antialiased font-sans bg-background text-foreground" suppressHydrationWarning>
        <JsonLd schema={buildWebSiteSchema()} />
        <JsonLd schema={buildOrganizationSchema()} />
        {is_maintenance_mode && !isAdmin ? (
          <MaintenanceScreen />
        ) : (
          <ThemeProvider>
            <GlobalBanner />
            {children}
          </ThemeProvider>
        )}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
