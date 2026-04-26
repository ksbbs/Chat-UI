import React from 'react';
import type { Metadata } from "next";
import type { Viewport } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { SessionProvider } from 'next-auth/react';
import ThemeProvider from '@/app/components/ThemeProvider';
import "./globals.css";

export const metadata: Metadata = {
  title: "HiveChat - Chatbot for Team",
  description: "同时和多个机器人聊天，最快获取最佳结果",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1677ff" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <SessionProvider>
            <AntdRegistry>
              <ThemeProvider>
                {children}
              </ThemeProvider>
            </AntdRegistry>
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
