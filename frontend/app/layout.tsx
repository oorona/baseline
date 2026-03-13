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
import { LanguageProvider } from "@/lib/i18n";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang is kept in sync dynamically by LanguageProvider via useEffect.
    // The static value here is the server-render default (English).
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
              {/*
               * LanguageProvider must be inside AuthProvider so it can read
               * user.preferences.language after login.
               * Default language for unauthenticated visitors is English ('en')
               * unless they already picked a language via the welcome page.
               */}
              <LanguageProvider>
                <div className="flex flex-col min-h-screen bg-background">
                  <Header />
                  <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    {children}
                  </main>
                </div>
              </LanguageProvider>
            </ThemeProvider>
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
