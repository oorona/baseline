import type { Metadata } from "next";
import "./globals.css";
import { Header } from "./components/Header";

import { siteConfig } from "./config";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
};

import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "./theme-provider";
import { Providers } from "./providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <Providers>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <div className="flex flex-col min-h-screen bg-background">
                <Header />
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                  {children}
                </main>
              </div>
            </ThemeProvider>
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
