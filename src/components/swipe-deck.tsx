import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Heart, MapPin, Star, X } from "lucide-react";
import type { Profile } from "@/data/profiles";
import type { Decision } from "@/lib/ember-store";

type Nudge = { id: string; decision: Decision; n: number };
type Leaving = Decision | null;

export function SwipeDeck({
  profiles,
  interests,
  onDecide,
}: {
  profiles: Profile[];
  interests: string[];
  onDecide: (id: string, decision: Decision) => void;
}) {
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [detail, setDetail] = useState<Profile | null>(null);
  const top = profiles[0];
  const next = profiles[1];

  function ask(decision: Decision) {
    if (!top) return;
    setNudge({ id: top.id, decision, n: Date.now() });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (detail) return;
      if (event.key === "ArrowLeft") ask("pass");
      if (event.key === "ArrowRight") ask("like");
      if (event.key === "ArrowUp") {
        event.preventDefault();
        ask("super");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!top) {
    return (
      <div className="flex flex-1 flex-col items-start justify-center px-6">
        <h2 className="font-serif text-4xl tracking-tight">You’re caught up</h2>
        <p className="mt-3 text-stone">Everyone nearby has been swiped. Widen the distance or start the deck over from You.</p>
      </div>
    );
  }

  if (detail) {
    return (
      <ProfileDetail
        profile={detail}
        interests={interests}
        onClose={() => setDetail(null)}
        onDecide={(decision) => {
          onDecide(detail.id, decision);
          setDetail(null);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative mx-4 min-h-0 flex-1">
        {next ? <BackCard profile={next} /> : null}
        <SwipeCard
          key={top.id}
          profile={top}
          interests={interests}
          nudge={nudge}
          onDecide={onDecide}
          onOpen={() => setDetail(top)}
        />
      </div>
      <div className="flex items-end justify-center gap-5 py-3">
        <RoundButton label="Pass" tone="pass" onClick={() => ask("pass")}>
          <X className="size-7" strokeWidth={3} aria-hidden="true" />
        </RoundButton>
        <RoundButton label="Super like" tone="super" onClick={() => ask("super")}>
          <Star className="size-6" fill="currentColor" aria-hidden="true" />
        </RoundButton>
        <RoundButton label="Like" tone="like" onClick={() => ask("like")}>
          <Heart className="size-8" fill="currentColor" aria-hidden="true" />
        </RoundButton>
      </div>
    </div>
  );
}

function BackCard({ profile }: { profile: Profile }) {
  return (
    <div className="absolute inset-x-3 top-3 bottom-0 overflow-hidden rounded-4xl bg-chip">
      <img src={profile.photo} alt="" className="h-full w-full object-cover opacity-80" />
    </div>
  );
}

function SwipeCard({
  profile,
  interests,
  nudge,
  onDecide,
  onOpen,
}: {
  profile: Profile;
  interests: string[];
  nudge: Nudge | null;
  onDecide: (id: string, decision: Decision) => void;
  onOpen: () => void;
}) {
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const offset = useRef({ x: 0, y: 0 });
  const busy = useRef(false);
  const seen = useRef(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<Leaving>(null);
  const shared = profile.interests.filter((item) => interests.includes(item));

  function move(next: { x: number; y: number }) {
    offset.current = next;
    setPos(next);
  }

  function fly(decision: Decision) {
    if (busy.current) return;
    busy.current = true;
    setDragging(false);
    setLeaving(decision);
  }

  useEffect(() => {
    if (!nudge || nudge.id !== profile.id || nudge.n === seen.current) return;
    seen.current = nudge.n;
    fly(nudge.decision);
  }, [nudge, profile.id]);

  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!leaving) return;
    if (reduce) {
      onDecide(profile.id, leaving);
      return;
    }
    const timer = window.setTimeout(() => onDecide(profile.id, leaving), 300);
    return () => window.clearTimeout(timer);
  }, [leaving, onDecide, profile.id, reduce]);

  const x = leaving === "pass" ? -560 : leaving === "like" ? 560 : leaving === "super" ? 0 : pos.x;
  const y = leaving === "super" ? -720 : leaving ? 36 : pos.y;
  const rot = leaving === "pass" ? -18 : leaving === "like" ? 16 : pos.x / 18;
  const like = leaving === "like" ? 1 : Math.max(0, Math.min(1, pos.x / 90));
  const nope = leaving === "pass" ? 1 : Math.max(0, Math.min(1, -pos.x / 90));
  const superO = leaving === "super" ? 1 : Math.max(0, Math.min(1, (-pos.y - 24) / 90));

  return (
    <article
      className={`swipe-surface absolute inset-x-0 top-0 bottom-3 overflow-hidden rounded-4xl bg-chip lift ${dragging || reduce ? "" : "card-move"}`}
      style={{ transform: `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)` }}
      onPointerDown={(event) => {
        if (busy.current || event.button !== 0) return;
        origin.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!origin.current || origin.current.id !== event.pointerId) return;
        move({
          x: event.clientX - origin.current.x,
          y: event.clientY - origin.current.y,
        });
      }}
      onPointerUp={(event) => {
        if (!origin.current || origin.current.id !== event.pointerId) return;
        origin.current = null;
        const { x: dx, y: dy } = offset.current;
        if (dy < -110 && Math.abs(dy) > Math.abs(dx)) fly("super");
        else if (dx > 110) fly("like");
        else if (dx < -110) fly("pass");
        else {
          setDragging(false);
          move({ x: 0, y: 0 });
        }
      }}
      onPointerCancel={() => {
        origin.current = null;
        setDragging(false);
        move({ x: 0, y: 0 });
      }}
    >
      <img src={profile.photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="photo-fade absolute inset-0" />
      <Stamp className="stamp-like left-6 top-14 border-[#21d07a] text-[#21d07a]" opacity={like} label="Like" />
      <Stamp className="stamp-nope right-6 top-14 border-[#ff4458] text-[#ff4458]" opacity={nope} label="Nope" />
      <Stamp className="stamp-super top-10 left-1/2 border-[#3ca4ff] text-[#3ca4ff]" opacity={superO} label="Super like" />
      {profile.likesYou ? (
        <span className="absolute top-4 left-4 rounded-full bg-white/95 px-3 py-1 text-xs font-bold tracking-wide text-[#fd267a]">
          Likes you
        </span>
      ) : null}
      <div className="card-copy absolute inset-x-0 bottom-0 p-5 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[2rem] leading-none font-bold tracking-tight">
              {profile.name} <span className="font-semibold">{profile.age}</span>
            </h2>
            <p className="mt-2 truncate text-[15px] font-medium">{profile.job}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-white/80">
              <MapPin className="size-3.5" aria-hidden="true" />
              {profile.km} kilometers away
            </p>
          </div>
          <button
            type="button"
            aria-label={`More about ${profile.name}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onOpen}
            className="tap grid size-9 shrink-0 place-items-center rounded-full border border-white/80 text-white"
          >
            <ChevronUp className="size-5" aria-hidden="true" />
          </button>
        </div>
        {shared.length > 0 ? (
          <p className="mt-3 text-sm text-white/90">You both like {shared.slice(0, 2).join(" and ")}</p>
        ) : null}
      </div>
    </article>
  );
}

function Stamp({
  className,
  opacity,
  label,
}: {
  className: string;
  opacity: number;
  label: string;
}) {
  return (
    <span
      className={`pointer-events-none absolute border-4 px-2 font-serif text-4xl uppercase ${className}`}
      style={{ opacity }}
    >
      {label}
    </span>
  );
}

function RoundButton({
  label,
  tone = "plain",
  onClick,
  children,
}: {
  label: string;
  tone?: "plain" | "cream" | "ember" | "pass" | "super" | "like";
  onClick: () => void;
  children: ReactNode;
}) {
  const toneClass =
    tone === "ember" || tone === "like"
      ? "size-16 bg-ember text-ink"
      : tone === "super"
        ? "size-12 bg-[#3aa0ff] text-cream"
        : tone === "cream"
          ? "size-12 bg-cream text-ink"
          : "size-14 border border-line bg-chip text-cream";
  return (
    <button type="button" aria-label={label} onClick={onClick} className={`tap grid place-items-center rounded-full ${toneClass}`}>
      {children}
    </button>
  );
}

function ProfileDetail({
  profile,
  interests,
  onClose,
  onDecide,
}: {
  profile: Profile;
  interests: string[];
  onClose: () => void;
  onDecide: (decision: Decision) => void;
}) {
  const shared = profile.interests.filter((item) => interests.includes(item));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scroller min-h-0 flex-1 overflow-y-auto">
        <img src={profile.photo} alt="" className="h-80 w-full object-cover" />
        <div className="px-5 py-5">
          <button type="button" onClick={onClose} className="text-sm font-medium text-ember">
            Back to card
          </button>
          <h2 className="mt-3 font-serif text-4xl tracking-tight">
            {profile.name}, {profile.age}
          </h2>
          <p className="mt-1 text-stone">
            {profile.job} · {profile.area} · {profile.km} km
          </p>
          <p className="mt-4">{profile.bio}</p>
          <div className="mt-5 rounded-3xl bg-panel p-4">
            <p className="text-sm text-stone">{profile.prompt}</p>
            <p className="mt-2 font-serif text-xl">{profile.answer}</p>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {profile.interests.map((item) => (
              <li
                key={item}
                className={
                  interests.includes(item)
                    ? "rounded-full bg-ember px-3 py-1 text-sm font-medium text-ink"
                    : "rounded-full bg-chip px-3 py-1 text-sm text-cream"
                }
              >
                {item}
              </li>
            ))}
          </ul>
          {shared.length > 0 ? <p className="mt-3 text-sm text-stone">Shared with you.</p> : null}
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 border-t border-line py-3">
        <RoundButton label="Pass" onClick={() => onDecide("pass")}>
          <X aria-hidden="true" />
        </RoundButton>
        <RoundButton label="Super like" tone="cream" onClick={() => onDecide("super")}>
          <Star aria-hidden="true" />
        </RoundButton>
        <RoundButton label="Like" tone="ember" onClick={() => onDecide("like")}>
          <Heart aria-hidden="true" />
        </RoundButton>
      </div>
    </div>
  );
}
