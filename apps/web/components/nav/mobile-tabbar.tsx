"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PRIMARY_NAV_LINKS } from "@/components/nav/app-nav-links";

export function MobileTabbar() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

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
        style={{ gridTemplateColumns: `repeat(${PRIMARY_NAV_LINKS.length}, minmax(0, 1fr))` }}
      >
        {PRIMARY_NAV_LINKS.map((item) => {
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
