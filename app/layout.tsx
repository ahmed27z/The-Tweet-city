import type { Metadata, Viewport } from 'next';
import { Silkscreen } from 'next/font/google';
import './globals.css';
import GlobalModals from '@/components/GlobalModals';

const silkscreen = Silkscreen({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-silkscreen',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TweetCity — Your Twitter as a 3D City',
  description:
    'Every Twitter/X account becomes a 3D pixel-art skyscraper in an explorable city. Inspired by thegitcity.com.',
};

export const viewport: Viewport = {
  themeColor: '#0d1117',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={silkscreen.variable}>
      <body className={silkscreen.variable}>
        {children}
        <GlobalModals />
      </body>
    </html>
  );
}
