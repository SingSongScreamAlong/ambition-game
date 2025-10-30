import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/QueryProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Ambition - Oracle Engine Sandbox',
  description: 'Turn your free-text ambitions into a solvable requirement graph and build your legend',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-secondary-50`}>
        <QueryProvider>
          <div className="min-h-full">
            <header className="bg-primary-600 shadow-sm">
              <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <h1 className="text-2xl font-bold text-white">
                      Ambition
                    </h1>
                    <span className="ml-2 text-sm text-primary-100">
                      Oracle Engine Sandbox
                    </span>
                  </div>
                  <nav className="flex space-x-4">
                    <a 
                      href="/"
                      className="text-primary-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Home
                    </a>
                    <a 
                      href="/new"
                      className="text-primary-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                    >
                      New Game
                    </a>
                  </nav>
                </div>
              </div>
            </header>
            
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </main>
            
            <footer className="bg-secondary-800 text-secondary-300 mt-12">
              <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <div className="text-center text-sm">
                  <p>Ambition - A text/browser/map-based sandbox powered by the Oracle Engine</p>
                  <p className="mt-1 text-secondary-400">
                    MVP Demo • Built with TypeScript, Next.js, and Fastify
                  </p>
                </div>
              </div>
            </footer>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}