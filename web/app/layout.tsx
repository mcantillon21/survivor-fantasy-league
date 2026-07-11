import type { Metadata } from "next";
import localFont from "next/font/local";
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

const survivorFont = localFont({
  src: "../public/fonts/NBInternationalProCG-Bold.woff2",
  variable: "--font-survivor",
  weight: "900",
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
      className={`${nbInternational.variable} ${survivorFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
