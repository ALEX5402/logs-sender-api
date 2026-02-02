import type { Metadata } from "next";
import { Toaster } from "sonner";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";
import "./globals.css";

export const metadata: Metadata = {
    title: "Logs Sender API",
    description: "High-performance API for log aggregation and analytics",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <style>{`
          :root {
            --font-jetbrains: 'JetBrains Mono', monospace;
          }
          body {
            font-family: var(--font-jetbrains);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
        `}</style>
            </head>
            <body>
                {children}
                <Toaster
                    theme="dark"
                    position="top-right"
                    toastOptions={{
                        style: {
                            background: 'rgba(18, 18, 26, 0.8)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#fff',
                            fontFamily: 'var(--font-jetbrains)',
                        },
                        className: 'my-toast-class',
                    }}
                />
            </body>
        </html>
    );
}
