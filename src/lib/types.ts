// ─── Shared domain types ─────────────────────────────────────────────────────
export type Role = "user" | "admin";
export type TaskType = "image" | "video" | "poster" | "character" | "text" | "audio";
export type Capability = "text" | "image" | "video" | "audio" | "tts" | "stt" | "vision" | "embedding";
export type JobStatus = "queued" | "preparing" | "generating" | "processing" | "completed" | "failed" | "cancelled";
export type AssetKind = "image" | "video" | "poster" | "character_image" | "character_video" | "logo" | "audio";
export type ProviderBilling = "free" | "freemium" | "paid";
export type ProviderStatus = "connected" | "error" | "disconnected";
export type TxType = "purchase" | "bonus" | "generation" | "refund" | "admin_adjustment";

export class ApiError extends Error {
  code: string; status: number; detail?: string;
  constructor(code: string, message: string, status = 400, detail?: string) {
    super(message); this.code = code; this.status = status; this.detail = detail;
  }
}

export interface UserPrefs {
  defaultProvider: string | null; defaultModel: string | null; defaultLanguage: string; defaultAspect: string;
  allowPaid: boolean; allowPaidFallback: boolean; notifyJobDone: boolean; notifyJobFailed: boolean; notifyCreditLow: boolean;
}
export interface User {
  id: string; email: string; name: string; role: Role; passHash: string; salt: string; suspended: boolean;
  onboarded: boolean; purpose: string | null; prefs: UserPrefs; createdAt: string; updatedAt: string;
}
export interface Session { id: string; userId: string; token: string; expiresAt: string; createdAt: string; }
export interface ProviderCredential {
  id: string; userId: string; providerId: string; label: string; keyEnc: { iv: string; ct: string } | null;
  endpoint: string | null; defaultModel: string | null; status: ProviderStatus; lastCheck: string | null;
  latencyMs: number | null; lastError: string | null; billing: ProviderBilling; extra: Record<string, string>;
  createdAt: string; updatedAt: string;
}
export interface ModelInfo {
  id: string; providerId: string; userId: string | null; name: string; displayName: string;
  capabilities: Capability[]; context: number | null; pricingNote: string; supports: Record<string, any>;
  enabled: boolean; source: "catalog" | "discovered"; createdAt: string;
}
export interface StageEvent { stage: string; at: string; honest: boolean; }
export interface Generation {
  id: string; userId: string; jobId: string; type: TaskType; status: JobStatus; prompt: string;
  params: Record<string, any>; providerId: string | null; model: string | null; simulated: boolean;
  creditEstimate: number; creditFinal: number | null; assetId: string | null; error: string | null;
  errorCode: string | null; stages: StageEvent[]; createdAt: string; updatedAt: string;
}
export interface Job {
  id: string; userId: string; generationId: string; status: JobStatus; stage: string; requestedCancel: boolean;
  createdAt: string; startedAt: string | null; finishedAt: string | null; error: string | null;
}
export interface Asset {
  id: string; userId: string; kind: AssetKind; name: string; mime: string; size: number; blobId: string | null;
  url: string | null; width: number | null; height: number | null; generationId: string | null;
  meta: Record<string, any>; createdAt: string;
}
export interface Character {
  id: string; userId: string; name: string; description: string; imageAssetId: string | null;
  videoAssetId: string | null; voice: string | null; meta: Record<string, any>; createdAt: string; updatedAt: string;
}
export interface CreditAccount { userId: string; balance: number; lifetime: number; used: number; version: number; updatedAt: string; }
export interface CreditTx { id: string; userId: string; type: TxType; amount: number; balanceAfter: number; note: string; refId: string | null; createdAt: string; }
export interface PricingRule {
  id: string; taskType: TaskType | "*"; providerId: string; model: string; base: number;
  unit: "per_generation" | "per_second" | "per_megapixel"; resolutionMult: Record<string, number>;
  qualityMult: Record<string, number>; note: string;
}
export interface Notification { id: string; userId: string; title: string; body: string; kind: "success" | "error" | "info" | "warning"; read: boolean; link: string | null; createdAt: string; }
export interface AdminSettings { mockEnabled: boolean; signupBonus: number; maxUploadMB: number; maintenanceMode: boolean; unlimitedMode: boolean; }
export interface ProviderDef { id: string; name: string; tagline: string; auth: "apikey" | "token" | "none"; billing: ProviderBilling; capabilities: Capability[]; docs: string; }
export interface DiscoveredModel { name: string; displayName: string; capabilities: Capability[]; size?: string; context?: number | null; pricingNote?: string; }
export interface HealthResult { ok: boolean; latencyMs: number; message?: string; }
export interface GenRequest {
  type: TaskType; prompt: string; negative?: string; width?: number; height?: number; aspect?: string;
  duration?: number; seed?: number; style?: string; camera?: string; language?: string; voice?: string;
  quality?: string; count?: number; temperature?: number; steps?: number; cfg?: number; fps?: number;
  characterImageUrl?: string; characterName?: string; expression?: string; action?: string; background?: string;
  scenes?: { prompt: string; duration: number; camera: string }[]; script?: string; modelHint?: string;
  signal?: AbortSignal; cancelCheck?: () => boolean;
}
export interface GenResult { blob?: Blob; url?: string; mime: string; width?: number; height?: number; text?: string; meta?: Record<string, any>; }
export interface ProviderCfg { apiKey: string | null; endpoint: string | null; model: string | null; extra: Record<string, string>; }
export interface AIProviderAdapter {
  id: string;
  validate(cfg: ProviderCfg): Promise<{ ok: boolean; message: string; models?: DiscoveredModel[] }>;
  health(cfg: ProviderCfg): Promise<HealthResult>;
  listModels(cfg: ProviderCfg): Promise<DiscoveredModel[]>;
  generate(cfg: ProviderCfg, req: GenRequest, onStage: (s: string, honest?: boolean) => void): Promise<GenResult>;
}
export interface ToastMsg { id: string; kind: "success" | "error" | "info" | "warning"; title: string; body?: string; }
export interface GpuInfo { vendor: string; name: string; vramMB: number | null; }
export interface MachineProfile {
  os: string; platform: string; architecture: string; source: "browser" | "bridge" | "bridge+browser";
  cpu: { name: string; cores: number; threads: number | null }; ramMB: number | null; gpus: GpuInfo[];
  disk: { totalMB: number | null; freeMB: number | null }; webgpu: boolean; checkedAt: string; warnings: string[];
}
export interface OllamaStatus {
  endpoint: string; reachable: boolean; installed: boolean | null; version: string | null; latencyMs: number | null;
  models: { name: string; sizeMB: number; vision: boolean; modified: string }[]; error: string | null;
}
export interface ModelRecommendation {
  name: string; category: "text" | "vision"; sizeMB: number; vramMB: number; vision: boolean;
  tier: "Best" | "Good" | "Experimental"; note: string; installed: boolean;
}
