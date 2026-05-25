import "./styles.css";

export const metadata = {
  title: "Bolna Call Audit",
  description: "Internal call auditing tool"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

