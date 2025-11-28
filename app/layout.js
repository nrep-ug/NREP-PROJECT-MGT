import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './globals.css';
import { SessionProvider } from '@/contexts/SessionContext';
import QueryProvider from '@/components/QueryProvider';

export const metadata = {
  title: 'NREP Project Management System',
  description: 'Production-ready Project Management System with Next.js and Appwrite',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <SessionProvider>
            {children}
          </SessionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
