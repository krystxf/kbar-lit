import type { ReactNode } from 'react';
import '@kbar-lit/example-actions/styles.css';
export const metadata = {
  title: 'kbar-lit · Next.js example',
  description: 'Lit command menu in a Next.js App Router application.',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
