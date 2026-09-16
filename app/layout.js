import localFont from "next/font/local";
import "./globals.css";

const timesNow = localFont({
  src: "../assets/TimesNow-SemiBoldItalic.ttf",
  weight: "600",
  style: "italic",
  variable: "--font-menu",
  display: "swap",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={timesNow.variable}>
      <body>{children}</body>
    </html>
  );
}
