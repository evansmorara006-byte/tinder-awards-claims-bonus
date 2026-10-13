import { createFileRoute, Link } from "@tanstack/react-router";
import { TinderMark } from "@/components/tinder-mark";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { t } = useLocale();
  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-6 text-cream">
      <div className="w-full max-w-sm">
        <TinderMark className="size-12" />
        <h1 className="mt-4 font-sans text-4xl font-extrabold tracking-tight">TINDER</h1>
        <p className="mt-2 text-stone">{t("loginBlurb")}</p>
        <Link to="/" className="brand-btn tap mt-8 inline-flex items-center justify-center">
          {t("continue")}
        </Link>
      </div>
    </main>
  );
}