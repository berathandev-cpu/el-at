"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "@/lib/i18n-client";
import { QuickSearch } from "./quick-search";
import searchStyles from "./quick-search.module.css";

const paths = {
  today: "M4 7h16v13H4z M4 11h16 M8 4v5 M16 4v5 M8 15h3",
  tasks: "M8 6h12 M8 12h12 M8 18h12 M3 6l1 1 2-2 M3 12l1 1 2-2 M3 18l1 1 2-2",
  home: "M3 10l9-7 9 7 M5 9v12h14V9 M9 21v-6h6v6",
  reward: "M3 8h18v4H3z M5 12v9h14v-9 M12 8v13 M12 8c-7 0-7-6-3-5 2 .5 3 5 3 5s1-4.5 3-5c4-1 4 5-3 5z",
  profile: "M15.5 7.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z M4.5 20v-1c0-3 3.4-5 7.5-5s7.5 2 7.5 5v1",
};

const tabs = [
  { href: "/bugun", label: "Bugün", icon: "today", children: [] },
  { href: "/gorevler", label: "Görevler", icon: "tasks", children: ["/tekrarlar"] },
  { href: "/ev", label: "Ev Haritası", icon: "home", children: [] },
  { href: "/oduller", label: "Ödüller", icon: "reward", children: [] },
  { href: "/ben", label: "Ben", icon: "profile", children: ["/aile", "/raporlar"] },
] as const;

function within(path: string, root: string) {
  return path === root || path.startsWith(root + "/");
}

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslations();
  const active = tabs.find((tab) => within(pathname, tab.href) || tab.children.some((route) => within(pathname, route)));
  if (!active) return children;

  return (
    <div className="app-shell">
      <a className="app-skip" href="#ekran">{t("İçeriğe geç")}</a>
      <header className="app-rail">
        <Link className="app-brand" href="/bugun">
          <span className="app-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l9-7 9 7M5.5 10v10h13V10M9 14l2 2 4-4" />
            </svg>
          </span>
          <span>El At!</span>
        </Link>
        <div className={searchStyles.dock}>
          <nav
            className="app-nav glass-control"
            aria-label={t("Ana gezinme")}
            style={{ "--active-tab": tabs.indexOf(active) } as CSSProperties}
          >
            <span className="app-nav-indicator" aria-hidden="true" />
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active.href === tab.href ? (pathname === tab.href ? "page" : "location") : undefined}
                className="app-tab"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[tab.icon]} /></svg>
                <span>{t(tab.label)}</span>
              </Link>
            ))}
          </nav>
          <QuickSearch key={pathname} />
        </div>
      </header>
      <div id="ekran" tabIndex={-1} className="app-content">
        {children}
      </div>
    </div>
  );
}
