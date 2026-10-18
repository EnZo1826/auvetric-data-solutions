"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

interface TurnstileApi {
  render(container: HTMLElement, options: { sitekey: string; theme: "dark"; size: "compact"; callback: () => void; "error-callback": () => void }): string;
  remove(widgetId: string): void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

/** Explicit lifecycle for SPA navigation and form remounts. Remount after every submission attempt:
 * tokens are single-use, so a server rejection must never leave a consumed token in the form.
 */
export function Turnstile({ siteKey }: { siteKey: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => { if (window.turnstile) setReady(true); }, []);
  useEffect(() => {
    const api = window.turnstile;
    if (!ready || !api || !container.current) return;
    const widgetId = api.render(container.current, {
      sitekey: siteKey,
      theme: "dark",
      size: "compact",
      callback: () => setError(false),
      "error-callback": () => setError(true),
    });
    return () => { api.remove(widgetId); };
  }, [ready, siteKey]);

  return <div>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} onError={() => setError(true)} />
    <div ref={container} />
    {error && <p role="alert" className="mt-2 text-sm text-warn">Verification could not load. Check your connection and try again.</p>}
  </div>;
}
