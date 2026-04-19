"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/strategies", label: "Strategies" },
  { href: "/tokens", label: "Tokens" },
  { href: "/allocation", label: "Allocation" },
  { href: "/alerts", label: "Alerts" },
];

export function MobileTabbar() {
  const pathname = usePathname();
  const { role } = useAuth();
  const [query, setQuery] = useState("");
  const links = role === "root_admin" ? [...baseLinks, { href: "/admin/token-policy", label: "Admin" }] : baseLinks;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setQuery(window.location.search);
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("oziebot:mode-sync", sync as EventListener);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("oziebot:mode-sync", sync as EventListener);
    };
  }, [pathname]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur md:hidden">
      <ul
        className="mx-auto grid max-w-lg gap-1"
        style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
      >
        {links.map((item) => {
          const active = pathname === item.href;
          const target = query ? `${item.href}${query}` : item.href;
          return (
            <li key={item.href}>
              <Link
                href={target}
                className={`flex h-11 items-center justify-center rounded-xl text-[11px] font-semibold tracking-wide ${
                  active ? "bg-surface text-foreground" : "text-muted"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
