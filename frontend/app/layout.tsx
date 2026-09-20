import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Sarabun } from 'next/font/google';
import './globals.css';

// โหลดฟอนต์ผ่าน next/font — ไม่ต้องยิงไป fonts.googleapis.com ตอนเปิดหน้า
const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sarabun',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CarePath',
  description: 'ระบบนำทางในโรงพยาบาลและติดตามขั้นตอนการรักษา — โรงพยาบาลวชิระภูเก็ต (ระบบสาธิต)',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${sarabun.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
