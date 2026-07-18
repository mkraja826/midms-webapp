import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const CACHE_RESET_SCRIPT = `
(function () {
  var version = "capdent-brand-2026-07-18-v4";
  try {
    var previous = localStorage.getItem("capdent-brand-version");
    if (previous !== version) {
      localStorage.setItem("capdent-brand-version", version);
      if ("caches" in window) {
        caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (key) { return caches.delete(key); }));
        });
      }
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
          registrations.forEach(function (registration) { registration.unregister(); });
        });
      }
    }
  } catch (error) {
    console.warn("CapDent cache reset skipped", error);
  }
})();
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <meta name="theme-color" content="#0F766E" />
        <meta name="application-name" content="CapDent" />
        <meta name="apple-mobile-web-app-title" content="CapDent" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <title>CapDent Clinic App</title>
        <link rel="icon" href="/capdent-icon.svg?v=20260718-4" type="image/svg+xml" />
        <link rel="shortcut icon" href="/capdent-icon.svg?v=20260718-4" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/capdent-icon.svg?v=20260718-4" />
        <link rel="manifest" href="/manifest.webmanifest?v=20260718-4" />
        <script dangerouslySetInnerHTML={{ __html: CACHE_RESET_SCRIPT }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
