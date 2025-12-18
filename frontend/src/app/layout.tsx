import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TSC Survey Platform",
  description:
    "Create, manage, and share professional surveys with ease. Collect valuable insights and feedback from your audience with our modern survey platform.",
  keywords: [
    "survey",
    "questionnaire",
    "feedback",
    "data collection",
    "research",
    "poll",
    "form",
  ],
  authors: [{ name: "Survey Concierge Team" }],
  creator: "Survey Concierge",
  publisher: "Survey Concierge",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("http://localhost:4545"),
  openGraph: {
    title: "Survey Concierge - Professional Survey Platform",
    description:
      "Create, manage, and share professional surveys with ease. Collect valuable insights and feedback from your audience.",
    url: "http://localhost:4545",
    siteName: "Survey Concierge",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Survey Concierge - Professional Survey Platform",
    description: "Create, manage, and share professional surveys with ease.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      {
        url: "/logos/TSC_Favicon.png?v=4",
        sizes: "any",
      },
      {
        url: "/logos/TSC_Favicon.png?v=4",
        type: "image/png",
      },
    ],
    apple: "/logos/TSC_Favicon.png?v=4",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/logos/TSC_Favicon.png?v=4" />
        <link rel="icon" href="/logos/TSC_Favicon.png?v=4" sizes="any" />
        <link rel="icon" href="/logos/TSC_Favicon.png?v=4" type="image/png" />
        <link rel="shortcut icon" href="/logos/TSC_Favicon.png?v=4" />
        <link rel="apple-touch-icon" href="/logos/TSC_Favicon.png?v=4" />
        <link rel="manifest" href="/manifest.json?v=4" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
