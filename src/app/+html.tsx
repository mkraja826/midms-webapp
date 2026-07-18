import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

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
        <meta name="theme-color" content="#0F766E" />
        <meta name="application-name" content="CapDent" />
        <meta name="apple-mobile-web-app-title" content="CapDent" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <title>CapDent Clinic App</title>
        <link rel="icon" href="/capdent-icon.svg?v=2" type="image/svg+xml" />
        <link rel="shortcut icon" href="/capdent-icon.svg?v=2" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/capdent-icon.svg?v=2" />
        <link rel="manifest" href="/manifest.webmanifest?v=2" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
