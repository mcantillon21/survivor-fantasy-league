import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { Bebas_Neue } from "next/font/google";
import { SiteNav } from "./components/site-nav";
import "./globals.css";

const nbInternational = localFont({
  src: [
    {
      path: "../public/fonts/NBInternationalProCG-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/NBInternationalProCG-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-nb-international",
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-survivor",
});

export const metadata: Metadata = {
  title: {
    default: "Survivor Fantasy League",
    template: "%s · Survivor Fantasy League",
  },
  description: "Your challenge-night command center for Survivor Fantasy League.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nbInternational.variable} ${bebasNeue.variable} h-full antialiased`}
    >
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <div className="app-shell">
          <header className="site-header">
            <Link className="site-brand" href="/" aria-label="Survivor Fantasy League home">
              <span className="site-brand__mark" aria-hidden="true">
                <span />
              </span>
              <span className="site-brand__type">
                <span className="site-brand__name">Survivor</span>
                <span className="site-brand__league">Fantasy League</span>
              </span>
            </Link>
            <SiteNav />
          </header>
          <main id="main-content" className="site-main">
            {children}
          </main>
          <footer className="site-footer">
            <span>Outwit. Outplay. Outscore.</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
