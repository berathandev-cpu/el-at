"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { FamilySearchResult as SearchResult } from "@/lib/family-search";
import type { Language } from "@/lib/i18n";
import { useTranslations } from "@/lib/i18n-client";
import styles from "./quick-search.module.css";

type SearchResponse =
  | { query: string; language: Language; results: SearchResult[] }
  | { query: string; language: Language; error: "request" | "session" };

const shortcuts = [
  { href: "/bugun", label: "Bugün" },
  { href: "/gorevler", label: "Görevler" },
  { href: "/ev", label: "Ev Haritası" },
  { href: "/oduller", label: "Ödüller" },
  { href: "/ben", label: "Ben" },
  { href: "/aile", label: "Ailem" },
];

function SearchIcon({ size = 21 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="5.75" />
      <path d="m15 15 4.75 4.75" />
    </svg>
  );
}

function ResultIcon({ kind }: { kind: SearchResult["kind"] }) {
  return (
    <svg className={styles.resultIcon} aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
      {kind === "task"
        ? <path d="M10 6h8M10 12h8M10 18h8M4.5 6l1 1 2-2M4.5 12l1 1 2-2M4.5 18l1 1 2-2" />
        : <path d="M4 20h16V8l-8-4-8 4zm5 0v-6h6v6" />}
    </svg>
  );
}

export function QuickSearch() {
  const { t, locale, language } = useTranslations();
  const dialogId = useId();
  const headingId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const navigatingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [attempt, setAttempt] = useState(0);
  const needle = query.trim().normalize("NFC");
  const eligible = Array.from(needle).length >= 2;
  const match = response?.query === needle && response.language === language ? response : null;
  const results = match && "results" in match ? match.results : [];
  const error = match && "error" in match ? match.error : null;

  const show = useCallback(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    if (!dialog || dialog.open || !trigger?.getClientRects().length) return;
    const focused = document.activeElement;
    openerRef.current = focused instanceof HTMLElement && focused !== document.body ? focused : trigger;
    navigatingRef.current = false;
    dialog.showModal();
    inputRef.current?.focus({ preventScroll: true });
    setOpen(true);
  }, []);

  useEffect(() => {
    function shortcut(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.isComposing ||
          !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey ||
          event.key.toLowerCase() !== "k" || !triggerRef.current?.getClientRects().length) return;
      event.preventDefault();
      if (dialogRef.current?.open) inputRef.current?.focus();
      else show();
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [show]);

  useEffect(() => {
    if (!open || !eligible) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/ara?" + new URLSearchParams({ q: needle }), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          if (!controller.signal.aborted) setResponse({ query: needle, language, error: response.status === 401 ? "session" : "request" });
          return;
        }
        const payload: { results: SearchResult[] } = await response.json();
        if (!controller.signal.aborted) setResponse({ query: needle, language, results: payload.results });
      } catch {
        if (!controller.signal.aborted) setResponse({ query: needle, language, error: "request" });
      }
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, eligible, needle, attempt, language]);

  function updateQuery(value: string) {
    const next = Array.from(value).slice(0, 80).join("");
    if (next.trim().normalize("NFC") !== needle) setResponse(null);
    setQuery(next);
  }

  function closeAfterNavigation() {
    navigatingRef.current = true;
    dialogRef.current?.close();
  }

  function handleClose() {
    if (dialogRef.current?.open) return;
    setOpen(false);
    setQuery("");
    setResponse(null);
    if (!navigatingRef.current) {
      const opener = openerRef.current;
      if (opener?.getClientRects().length) opener.focus({ preventScroll: true });
      else triggerRef.current?.focus({ preventScroll: true });
    }
  }

  function handleKeys(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.currentTarget.close();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a[data-search-link]"));
    const focused = document.activeElement;
    const input = inputRef.current;
    const index = links.findIndex((link) => link === focused);
    if (event.key === "Enter") {
      if (focused === input && links.length > 0) {
        event.preventDefault();
        links[0].click();
      }
      return;
    }
    if (!links.length || (focused !== input && index === -1)) return;
    event.preventDefault();
    if (focused === input) {
      (event.key === "ArrowDown" ? links[0] : links.at(-1))?.focus();
    } else {
      const next = links[index + (event.key === "ArrowDown" ? 1 : -1)];
      (next ?? input)?.focus();
    }
  }

  const groups = [
    { kind: "task", label: "Görevler" },
    { kind: "room", label: "Odalar" },
  ] as const;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`glass-control ${styles.trigger}`}
        aria-label={t("Hızlı arama")}
        aria-haspopup="dialog"
        aria-controls={dialogId}
        aria-expanded={open}
        aria-keyshortcuts="Control+K Meta+K"
        onClick={show}
      >
        <SearchIcon />
        <span>{t("Ara")}</span>
        <kbd className={styles.shortcut} aria-hidden="true">Ctrl K</kbd>
      </button>
      <dialog
        id={dialogId}
        ref={dialogRef}
        className={`glass-control ${styles.dialog}`}
        aria-labelledby={headingId}
        onClose={handleClose}
        onKeyDown={handleKeys}
      >
        <div className={styles.controls}>
          <div className={styles.headingRow}>
            <h2 id={headingId}>{t("Hızlı arama")}</h2>
            <button type="button" className={styles.dismiss} onClick={() => dialogRef.current?.close()}>{t("Kapat")}</button>
          </div>
          <div className={styles.field}>
            <SearchIcon size={20} />
            <input
              ref={inputRef}
              type="search"
              aria-label={t("Görev ve oda ara")}
              placeholder={t("Görev veya oda adı")}
              autoComplete="off"
              enterKeyHint="search"
              value={query}
              onChange={(event) => updateQuery(event.currentTarget.value)}
            />
            {query && (
              <button type="button" className={styles.clear} aria-label={t("Aramayı temizle")} onClick={() => {
                updateQuery("");
                inputRef.current?.focus();
              }}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m7 7 10 10M17 7 7 17" /></svg>
              </button>
            )}
          </div>
        </div>
        <div className={styles.contents} aria-busy={eligible && !match}>
          <p className="sr-only" role="status">{eligible && match && !error ? t("{count} sonuç", {
            count: results.length.toLocaleString(locale), plural: results.length === 1 ? "" : "s",
          }) : ""}</p>
          {!eligible && (
            <>
              <p className={styles.hint}>{t(needle ? "Aramak için en az iki karakter yaz." : "Örneğin mutfak veya çamaşır yaz.")}</p>
              <h3 className={styles.groupTitle}>{t("Kısayollar")}</h3>
              <ul className={styles.shortcuts}>
                {shortcuts.map(({ href, label }) => (
                  <li key={href}><Link href={href} prefetch={false} data-search-link onNavigate={closeAfterNavigation}>{t(label)}</Link></li>
                ))}
              </ul>
            </>
          )}
          {eligible && !match && <p className={styles.hint}>{t("Aranıyor…")}</p>}
          {eligible && error === "request" && (
            <div className={styles.feedback}>
              <p role="alert">{t("Arama sonuçları alınamadı.")}</p>
              <button type="button" className={styles.dismiss} onClick={() => {
                setResponse(null);
                setAttempt((count) => count + 1);
              }}>{t("Tekrar dene")}</button>
            </div>
          )}
          {eligible && error === "session" && (
            <div className={styles.feedback}>
              <p role="alert">{t("Oturumunun süresi doldu.")}</p>
              <Link href="/giris" className={styles.dismiss} prefetch={false} onNavigate={closeAfterNavigation}>{t("Giriş yap")}</Link>
            </div>
          )}
          {eligible && match && !error && results.length === 0 && (
            <p className={styles.hint}>{t("Sonuç bulunamadı. Başka bir görev veya oda adı dene.")}</p>
          )}
          {groups.map(({ kind, label }) => {
            const items = results.filter((item) => item.kind === kind);
            if (!items.length) return null;
            return (
              <section className={styles.group} key={kind}>
                <h3 className={styles.groupTitle}>{t(label)}</h3>
                <ul className={styles.results}>
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} prefetch={false} data-search-link onNavigate={closeAfterNavigation} className={styles.result}>
                        <ResultIcon kind={item.kind} />
                        <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m10 6 6 6-6 6" /></svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </dialog>
    </>
  );
}
