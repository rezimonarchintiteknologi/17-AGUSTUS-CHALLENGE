import './globals.css';

export const metadata = {
  title: 'Customer Intelligence Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
