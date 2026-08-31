import { ApiError, CreditAccount, CreditTx, PricingRule, Role, Session, TaskType, User } from "../lib/types";
import { hashPassword, nowIso, uid } from "../lib/utils";
import { db, getAdminSettings } from "./db";

const TOKEN_KEY = "acs:token";
export const localToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const publicUser = (u: User) => ({
  id: u.id, email: u.email, name: u.name, role: u.role as Role, onboarded: u.onboarded, purpose: u.purpose, prefs: u.prefs, createdAt: u.createdAt,
});

export const auth = {
  publicUser,
  me(token: string | null) {
    if (!token) return null;
    const s = db.where<Session>("sessions", (x) => x.token === token)[0];
    if (!s || new Date(s.expiresAt) < new Date()) return null;
    const u = db.get<User>("users", s.userId);
    if (!u || u.suspended) return null;
    return publicUser(u);
  },
  requireUser(token: string | null) {
    const u = this.me(token);
    if (!u) throw new ApiError("UNAUTHORIZED", "Please sign in.", 401);
    return u;
  },
  requireAdmin(token: string | null) {
    const u = this.requireUser(token);
    if (u.role !== "admin") throw new ApiError("FORBIDDEN", "Admin access required.", 403);
    return u;
  },
  async login(email: string, password: string) {
    const u = db.where<User>("users", (x) => x.email.toLowerCase() === email.trim().toLowerCase())[0];
    if (!u) throw new ApiError("BAD_CREDENTIALS", "Invalid email or password.", 401);
    if (u.suspended) throw new ApiError("SUSPENDED", "This account is suspended.", 403);
    const hash = await hashPassword(password, u.salt);
    if (hash !== u.passHash) throw new ApiError("BAD_CREDENTIALS", "Invalid email or password.", 401);
    const token = uid() + uid();
    db.insert("sessions", { id: uid(), userId: u.id, token, expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(), createdAt: nowIso() } satisfies Session);
    localToken.set(token);
    return { token, user: publicUser(u) };
  },
  logout(token: string | null) {
    if (token) db.where<Session>("sessions", (s) => s.token === token).forEach((s) => db.remove("sessions", s.id));
    localToken.clear();
  },
  async changePassword(token: string, current: string, next: string) {
    const me = this.requireUser(token);
    const u = db.get<User>("users", me.id)!;
    if ((await hashPassword(current, u.salt)) !== u.passHash) throw new ApiError("BAD_CREDENTIALS", "Current password is wrong.", 401);
    if (next.length < 8) throw new ApiError("WEAK", "New password must be at least 8 characters.", 422);
    const salt = uid();
    db.update("users", u.id, { salt, passHash: await hashPassword(next, salt) });
  },
};

// ── CreditEngine (reserve → commit → refund, mutex-protected) ──
let lockChain: Promise<any> = Promise.resolve();
function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const next = lockChain.then(fn, fn);
  lockChain = next.catch(() => undefined);
  return next;
}
function findRule(taskType: TaskType, providerId: string | null, model: string | null): PricingRule {
  const rules = db.all<PricingRule>("pricing_rules").filter((r) => r.taskType === taskType || r.taskType === "*");
  const score = (r: PricingRule) =>
    (r.providerId === providerId ? 4 : r.providerId === "*" ? 0 : -100) + (r.model === model ? 2 : r.model === "*" ? 0 : -100);
  const ranked = rules.filter((r) => score(r) >= 0).sort((a, b) => score(b) - score(a));
  if (!ranked.length) throw new ApiError("NO_PRICING", `No pricing rule for ${taskType}.`, 500);
  return ranked[0];
}

export const creditEngine = {
  account(userId: string): CreditAccount {
    let acc = db.where<CreditAccount>("credit_accounts", (a) => a.userId === userId)[0];
    if (!acc) { acc = { userId, balance: 0, lifetime: 0, used: 0, version: 0, updatedAt: nowIso() }; db.insert("credit_accounts", acc); }
    return acc;
  },
  calculate(opts: { taskType: TaskType; providerId: string | null; model: string | null; durationSec?: number; width?: number; height?: number; quality?: string; resolution?: string; count?: number }) {
    const rule = findRule(opts.taskType, opts.providerId, opts.model);
    if (getAdminSettings().unlimitedMode) return { credits: 0, rule };
    let credits = rule.base;
    if (rule.unit === "per_second") credits = rule.base * Math.max(1, opts.durationSec ?? 5);
    if (rule.unit === "per_megapixel") credits = rule.base * (((opts.width ?? 1024) * (opts.height ?? 1024)) / 1e6);
    if (opts.resolution && rule.resolutionMult[opts.resolution] != null) credits *= rule.resolutionMult[opts.resolution];
    if (opts.quality && rule.qualityMult[opts.quality] != null) credits *= rule.qualityMult[opts.quality];
    credits *= Math.max(1, opts.count ?? 1);
    return { credits: Math.max(0, Math.ceil(credits)), rule };
  },
  async reserve(userId: string, amount: number, refId: string, note: string): Promise<number> {
    return withLock(() => {
      if (amount <= 0) return 0;
      const rows = db.all<CreditAccount>("credit_accounts");
      const row = rows.find((a) => a.userId === userId);
      if (!row || row.balance < amount) throw new ApiError("INSUFFICIENT_CREDITS", `Needs ${amount} credits, you have ${row?.balance ?? 0}.`, 402);
      row.balance -= amount; row.used += amount; row.version += 1; row.updatedAt = nowIso();
      db.setMany("credit_accounts", rows);
      db.insert("credit_transactions", { id: uid(), userId, type: "generation", amount: -amount, balanceAfter: row.balance, note: `Reserved — ${note}`, refId, createdAt: nowIso() } satisfies CreditTx);
      return amount;
    });
  },
  async finalize(userId: string, reserved: number, actual: number, refId: string, note: string) {
    return withLock(() => {
      if (reserved <= 0) return;
      actual = Math.min(actual, reserved);
      const delta = reserved - actual;
      if (delta <= 0) return;
      const rows = db.all<CreditAccount>("credit_accounts");
      const row = rows.find((a) => a.userId === userId);
      if (!row) return;
      row.balance += delta; row.used -= delta; row.version += 1; row.updatedAt = nowIso();
      db.setMany("credit_accounts", rows);
      db.insert("credit_transactions", { id: uid(), userId, type: "refund", amount: delta, balanceAfter: row.balance, note: `Refund — ${note}`, refId, createdAt: nowIso() } satisfies CreditTx);
    });
  },
  async refund(userId: string, amount: number, refId: string, note: string) {
    if (amount <= 0) return;
    return this.finalize(userId, amount, 0, refId, note);
  },
  async credit(userId: string, amount: number, type: CreditTx["type"], note: string, byAdmin = false) {
    return withLock(() => {
      const rows = db.all<CreditAccount>("credit_accounts");
      let row = rows.find((a) => a.userId === userId);
      if (!row) { row = { userId, balance: 0, lifetime: 0, used: 0, version: 0, updatedAt: nowIso() }; rows.push(row); }
      row.balance += amount;
      if (amount > 0) row.lifetime += amount; else row.used += -amount;
      row.version += 1; row.updatedAt = nowIso();
      db.setMany("credit_accounts", rows);
      db.insert("credit_transactions", { id: uid(), userId, type, amount, balanceAfter: row.balance, note: byAdmin ? `${note} (admin)` : note, refId: null, createdAt: nowIso() } satisfies CreditTx);
    });
  },
  transactions(userId: string): CreditTx[] {
    return db.where<CreditTx>("credit_transactions", (t) => t.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
};
