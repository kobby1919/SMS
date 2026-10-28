import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: {
    default: "Edujay",
    template: "Edujay — %s",
  },
  description: "Modern School Management System",
  icons: {
    icon: "/edujay-favicon.png",
    shortcut: "/edujay-favicon.png",
    apple: "/edujay-favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} appearance={{ variables: { fontFamily: "var(--font-body)" }, elements: { headerTitle: { fontFamily: "var(--font-heading)", fontWeight: 700, letterSpacing: "0" } } }}>
      <html
        lang="en"
        className="h-full antialiased"
      >
        <body className="min-h-full flex flex-col font-inter">{children}</body>
      </html>
    </ClerkProvider>
  );
}
