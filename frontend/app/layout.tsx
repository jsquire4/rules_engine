import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Governance Console — Rules Engine',
  description: 'Agent governance and policy management console',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Header />
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
