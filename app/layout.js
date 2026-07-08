import './globals.css';
import RegisterSW from './RegisterSW';

export const metadata = {
  title: 'FOURNITY — Celebrating our Union with God in Christ Jesus',
  description:
    'An Illumination of the revelation of the Unity of Trinity and Humanity — before Genesis 1:1, lost in Genesis 3, restored in Acts 2. By Rev Mokoro Manana.',
  openGraph: {
    title: 'FOURNITY — Celebrating our Union with God in Christ Jesus',
    description:
      'An Illumination of the revelation of the Unity of Trinity and Humanity. 40 chapters. 8 layers. One identity.',
    type: 'website',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FOURNITY',
  },
};

export const viewport = {
  themeColor: '#c9a84c',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
