import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import { ThemeController } from "@/components/theme-controller";
import { RouteTransition } from "@/components/visual-transition";
import "@/components/visual-transition.css";
import { VersionWatcher } from "@/components/version-watcher";
import { LocaleProvider } from "@/i18n/client";
import { getLocale } from "@/i18n/server";
import { resolveTheme } from "@/lib/theme";
import "./globals.css";

// Runs in the initial document head so the chosen palette is set before the first paint.
const themeScript = `(() => {
  const resolveTheme = (${resolveTheme.toString()});
  let choice = null;
  try {
    choice = localStorage.getItem("fah-theme");
  } catch { /* Storage may be unavailable in private browsing. */ }
  const selected = resolveTheme(choice, new Date().getHours(), window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.themeChoice = selected.choice;
  document.documentElement.dataset.theme = selected.theme;
  try {
    if (localStorage.getItem("fah-large-text") === "1") document.documentElement.dataset.text = "large";
  } catch { /* Storage may be unavailable in private browsing. */ }
})();`;

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-plex-sans-thai",
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ฟ้าวันนี้ · สถานการณ์น้ำท่วม",
  description: "ฟ้าวันนี้ · สถานการณ์น้ำท่วม",
  appleWebApp: { capable: true, title: "ฟ้าวันนี้", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head><link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" /></head>
      <body className={`${ibmPlexSansThai.variable} antialiased`}>
        <Script id="fah-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeController />
        <LocaleProvider locale={locale}><RouteTransition>{children}</RouteTransition></LocaleProvider>
        <VersionWatcher />
        <Toaster position="top-center" toastOptions={{ style: { background: "var(--card)", color: "var(--foreground)", borderColor: "var(--border)", fontFamily: "inherit" } }} />
        <SpeedInsights />
        {/* Page views only, no cookies and no personal data; it loads on Vercel deployments, not locally. */}
        <Analytics />
      </body>
    </html>
  );
}
