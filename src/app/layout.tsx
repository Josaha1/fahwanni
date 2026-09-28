import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Anuphan, Mitr } from "next/font/google";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import { ThemeController } from "@/components/theme-controller";
import { BottomNav } from "@/components/bottom-nav";
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

const anuphan = Anuphan({
  variable: "--font-anuphan",
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  display: "swap",
});

const mitr = Mitr({
  variable: "--font-mitr",
  weight: ["500", "600"],
  subsets: ["thai", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ฟ้าวันนี้",
  appleWebApp: { capable: true, title: "ฟ้าวันนี้", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7FBFF" },
    { media: "(prefers-color-scheme: dark)", color: "#1F2740" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head><link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" /></head>
      <body className={`${anuphan.variable} ${mitr.variable} antialiased`}>
        <Script id="fah-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeController />
        <LocaleProvider locale={locale}>{children}<BottomNav /></LocaleProvider>
        <VersionWatcher />
        <Toaster position="top-center" toastOptions={{ style: { background: "var(--card)", color: "var(--foreground)", borderColor: "var(--border)", fontFamily: "inherit" } }} />
        <SpeedInsights />
        {/* Page views only, no cookies and no personal data; it loads on Vercel deployments, not locally. */}
        <Analytics />
      </body>
    </html>
  );
}
