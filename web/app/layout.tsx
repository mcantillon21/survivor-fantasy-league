import type { Metadata } from "next";
import localFont from "next/font/local";
import { Bebas_Neue } from "next/font/google";
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
  title: "Survivor Fantasy League",
  description: "AI-hosted online Survivor game",
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
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
