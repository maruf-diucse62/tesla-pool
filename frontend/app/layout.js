import './globals.css';
export const metadata = { title: 'Dhaka Tesla Pool', description: 'Share a seat. Split the fare. Survive Dhaka traffic.' };
export default function Layout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <footer className="site-footer">
          © {new Date().getFullYear()} Md Abdullah Al Maruf · <a href="mailto:maruf.diucse62@gmail.com">maruf.diucse62@gmail.com</a>
        </footer>
      </body>
    </html>
  );
}
