import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import AgentationGate from "@/components/dev/AgentationGate";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

// Site-wide SEO metadata. Per-page layouts override `title` via the
// template ("Page Name | Aegis") while inheriting description/OG/etc.
// Copy uses plain hyphens only (no em or en dashes) and short
// declarative sentences so the writing reads as human-authored.
export const metadata: Metadata = {
  title: {
    default: "Aegis - AI Agent Governance Platform",
    template: "%s | Aegis",
  },
  description:
    "Monitor, control, and audit every AI agent action across your repositories. Set governance policies, approve risky operations, and keep a complete activity record.",
  applicationName: "Aegis",
  keywords: [
    "AI agent governance",
    "MCP",
    "AI agent monitoring",
    "AI agent audit",
    "Claude Code",
    "Cursor",
    "AI policy enforcement",
    "developer tools",
    "agent oversight",
  ],
  authors: [{ name: "Aegis" }],
  creator: "Aegis",
  publisher: "Aegis",
  openGraph: {
    type: "website",
    siteName: "Aegis",
    title: "Aegis - AI Agent Governance Platform",
    description:
      "Monitor, control, and audit every AI agent action across your repositories.",
    locale: "en_US",
    // images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Aegis" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aegis - AI Agent Governance Platform",
    description:
      "Monitor, control, and audit every AI agent action across your repositories.",
    // images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    // Prefer the adaptive SVG — uses currentColor + a prefers-color-scheme
    // media query so the shield mark flips between black (light browser
    // chrome) and white (dark browser chrome) automatically.
    // PNG fallbacks let browsers that don't load SVG favicons (older
    // Safari, some Android variants) still pick the right tone.
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      {
        url: "/favicon-light.png",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-dark.png",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon-light.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full ${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* FOUC-prevention: applies dashboard chrome state BEFORE React
            hydrates so the first paint already shows the user's saved
            preferences (dark theme + collapsed sidebar). Without this,
            users would see a flash of default-light-expanded layout
            for one frame before hydration corrects it.

            Reads `aegis_theme` and `aegis_sidebar_collapsed` from
            localStorage and writes the matching dataset attributes on
            <html>. Both attributes are also scoped to /dashboard —
            auth/onboarding always render in default chrome.

            Inline + sync because it has to run before any CSS paints.
            Wrapped in try/catch because localStorage may throw in
            embedded contexts (iframes with cookies disabled, etc.). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=location.pathname;var onDash=p.startsWith('/dashboard');var onOnboard=p.startsWith('/onboarding');if(!onDash&&!onOnboard)return;if(onDash){if(localStorage.getItem('aegis_theme')==='dark')document.documentElement.dataset.theme='dark';if(localStorage.getItem('aegis_sidebar_collapsed')==='true')document.documentElement.dataset.sidebarCollapsed='true';}var d=localStorage.getItem('aegis_demo');var url=new URLSearchParams(location.search);if(url.get('demo')==='1'||url.get('preview')==='1'||d==='true')document.documentElement.dataset.demo='true';}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-[var(--bg-app)] text-[var(--text-strong)] antialiased">
        <ToastProvider>{children}</ToastProvider>
        {/* Floating annotation toolbar — dev-only. AgentationGate is
            a thin client wrapper that does the next/dynamic + NODE_ENV
            gate so the `agentation` library never enters prod bundles.
            Mounted ONCE here at the root so annotations work on every
            route (auth, onboarding, dashboard, email previews). */}
        <AgentationGate />
      </body>
    </html>
  );
}
