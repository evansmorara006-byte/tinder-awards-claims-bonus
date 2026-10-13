import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { LocaleHint, chooseLocale, readAcceptLanguage } from "@/lib/locale";
import appCss from "../styles.css?url";

const APP_NAME = "TINDER";

export const Route = createRootRoute({
  beforeLoad: async () => {
    const acceptLanguage = await readAcceptLanguage();
    return { acceptLanguage };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" },
      { title: APP_NAME },
      { name: "theme-color", content: "#110e0c" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,560;0,9..144,640;1,9..144,560&family=Outfit:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: Root,
});

function Root() {
  const { acceptLanguage } = Route.useRouteContext() as { acceptLanguage?: string };
  const hint = acceptLanguage ?? "";
  const lang = chooseLocale(hint);
  return (
    <LocaleHint.Provider value={hint}>
      <html lang={lang} suppressHydrationWarning>
        <head>
          <HeadContent />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__ACCEPT_LANGUAGE=${JSON.stringify(hint)};`,
            }}
          />
        </head>
        <body>
          <PreviewHostBridge />
          <AuthProvider>
            <Outlet />
          </AuthProvider>
          <Scripts />
        </body>
      </html>
    </LocaleHint.Provider>
  );
}