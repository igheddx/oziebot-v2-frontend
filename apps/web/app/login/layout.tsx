import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Sign in · OzieBot",
  description: "Sign in to the OzieBot platform.",
};

export const viewport: Viewport = {
  themeColor: "#f4f7fb",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
