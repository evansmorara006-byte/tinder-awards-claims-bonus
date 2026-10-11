import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import {
  claimReviewer,
  listQueue,
  reviewApplication,
  type Access,
  type QueueItem,
} from "@/lib/applications";

function queueLabel(item: QueueItem) {
  if (item.status === "pending") return "Pending";
  if (item.status === "rejected") return "Declined";
  if (!item.emailVerified) return "Email code";
  if (!item.phoneVerified) return "Phone code";
  return "In";
}

export function ReviewQueue({
  needsReviewer,
  onClose,
  onAccess,
}: {
  needsReviewer: boolean;
  onClose: () => void;
  onAccess: (access: Access) => void;
}) {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const claimed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (needsReviewer && !claimed.current) {
          claimed.current = true;
          const access = await claimReviewer();
          if (!cancelled) onAccess(access);
        }
        const queue = await listQueue();
        if (!cancelled) setItems(queue);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load requests");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [needsReviewer, onAccess]);

  async function decide(id: number, status: "approved" | "rejected") {
    setBusyId(id);
    setError(null);
    try {
      const access = await reviewApplication({ data: { id, status } });
      onAccess(access);
      setItems(await listQueue());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusyId(null);
    }
  }

  const pending = items?.filter((item) => item.status === "pending").length ?? 0;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 items-center gap-2 px-3">
        <button type="button" onClick={onClose} aria-label="Back" className="tap grid size-11 place-items-center rounded-full">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div>
          <h1 className="font-serif text-xl leading-none">Review</h1>
          <p className="text-xs text-stone">{pending} waiting</p>
        </div>
      </header>
      <div className="scroller min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {error ? <p className="mb-3 text-sm text-ember">{error}</p> : null}
        {items === null && !error ? <p className="text-stone">Loading requests…</p> : null}
        {items?.length === 0 ? (
          <p className="mt-8 text-stone">No one has submitted an email and phone yet.</p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {items?.map((item) => (
            <li key={item.id} className="rounded-4xl border border-line bg-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.country}</p>
                  <p className="mt-1 text-sm text-cream">{item.email}</p>
                  <p className="text-sm text-stone">{item.phone}</p>
                </div>
                <span className="rounded-full bg-chip px-2 py-1 text-xs font-medium text-stone">
                  {queueLabel(item)}
                </span>
              </div>
              {item.emailCode ? (
                <p className="mt-3 text-sm text-cream">
                  Email code <span className="font-semibold tabular-nums">{item.emailCode}</span>
                </p>
              ) : null}
              {item.emailVerified && item.phoneCode ? (
                <p className="text-sm text-cream">
                  Phone code <span className="font-semibold tabular-nums">{item.phoneCode}</span>
                </p>
              ) : null}
              {item.emailCode ? (
                <p className="mt-1 text-xs text-stone">Phone and email, then email code, then phone code, then the reward.</p>
              ) : null}
              {item.status === "pending" ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void decide(item.id, "rejected")}
                    className="tap h-11 rounded-xl border border-line text-sm font-medium text-cream disabled:opacity-40"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void decide(item.id, "approved")}
                    className="tap h-11 rounded-xl bg-ember text-sm font-semibold text-ink disabled:opacity-40"
                  >
                    Approve
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
