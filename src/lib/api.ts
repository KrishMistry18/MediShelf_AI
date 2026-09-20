/**
 * Typed client for the MediShelf AI FastAPI backend.
 *
 * The backend runs as a separate process (see tools/serve_api.py) because inference needs
 * PyTorch and scikit-learn. Requests therefore go cross-origin to an absolute base URL
 * rather than through a Vite dev proxy, so the setup stays identical across dev, preview,
 * and any hosted deployment.
 *
 * Point the app at a different API with VITE_API_BASE_URL in .env.
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:8000";

/** Bracket access: ImportMetaEnv is an index signature and the project sets noPropertyAccessFromIndexSignature. */
export const API_BASE_URL = (
  import.meta.env["VITE_API_BASE_URL"] ??
  import.meta.env["VITE_API_URL"] ??
  DEFAULT_BASE_URL
).replace(/\/$/, "");

/* ------------------------------------------------------------------ *
 * Response types — mirror backend/app/schemas/
 * ------------------------------------------------------------------ */

export type SystemHealth = {
  status: string;
  version: string;
  project_name: string;
  environment: string;
  database: string;
  timestamp: string;
  details?: Record<string, unknown> | null;
  disclaimer?: string;
};

export type Medicine = {
  id: number;
  medicine_id: string;
  medicine_name: string;
  generic_name: string;
  brand_name: string | null;
  strength: string;
  dosage_form: string;
  category: string;
  manufacturer: string | null;
  storage_min_temperature: number;
  storage_max_temperature: number;
  storage_min_humidity: number | null;
  storage_max_humidity: number | null;
  expiry_warning_days: number;
  image_class: string;
  source: string;
  source_url: string;
  created_at: string;
  updated_at: string;
};

export type MedicineListResponse = {
  items: Medicine[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type CategoryCount = { category: string; count: number };

export type PredictionItem = {
  class_name: string;
  confidence: number;
  medicine_id: string | null;
  medicine_name: string | null;
};

export type ImageQualityAssessment = {
  is_acceptable: boolean;
  blur_score: number;
  mean_brightness: number;
  width: number;
  height: number;
  resolution: string;
  issues: string[];
  recommendations: string[];
};

export type ExtractedField = {
  field_name: string | null;
  value: string | null;
  raw_text: string | null;
  original_text: string | null;
  ocr_engine_confidence: number | null;
  parser_confidence: number | null;
  db_match_confidence: number | null;
  is_user_corrected: boolean;
};

export type StructuredFields = {
  medicine_name: ExtractedField;
  generic_name: ExtractedField;
  strength: ExtractedField;
  dosage_form: ExtractedField;
  batch_number: ExtractedField;
  expiry_date: ExtractedField;
  manufacturing_date: ExtractedField;
  manufacturer: ExtractedField;
};

export type CandidateMatch = {
  medicine_id: string;
  medicine_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  similarity_score: number;
  matched_token: string;
};

/** How the two evidence streams line up. Never a claim about product genuineness or safety. */
export type IdentificationStatus = "CONFIRMED" | "PARTIAL" | "DIVERGENT" | "UNCONFIRMED";

export type FusionAssessment = {
  identification_status: IdentificationStatus;
  agreement_score: number;
  cv_prediction: string | null;
  ocr_match: string | null;
  strength_match: boolean;
  dosage_form_match: boolean | null;
  reasons: string[];
};

/** completed = text read; skipped_low_quality = image failed the gate; unavailable = engine not loaded. */
export type OcrStatus = "completed" | "skipped_low_quality" | "unavailable";

export type ScanResponse = {
  recognized: boolean;
  is_confident: boolean;
  confidence: number;
  confidence_threshold: number;
  predicted_class: string;
  top_predictions: PredictionItem[];
  recognition: {
    predicted_class: string;
    confidence: number;
    confidence_threshold: number;
    is_confident: boolean;
    top_predictions: PredictionItem[];
  } | null;
  ocr: {
    raw_text: string;
    fields: StructuredFields;
    engine: string;
    candidate_matches: CandidateMatch[];
    status: OcrStatus;
    error: string | null;
  } | null;
  fusion: FusionAssessment | null;
  quality: ImageQualityAssessment | null;
  medicine: Medicine | null;
  storage_requirements: {
    min_temperature: number;
    max_temperature: number;
    min_humidity: number | null;
    max_humidity: number | null;
    temperature_unit: string;
    regulatory_source: string;
  } | null;
  ocr_status: OcrStatus;
  inference_time_ms: number;
  message: string;
};

export type RiskLevel = "LOW" | "MODERATE" | "HIGH";

export type MLFactorImportance = {
  feature: string;
  feature_label: string;
  importance_weight: number;
  observed_value: unknown;
  interpretation: string;
};

export type StorageRiskRequest = {
  medicine_id: string;
  current_temperature: number;
  current_humidity?: number;
  excursion_duration_hours: number;
  days_to_expiry?: number;
  expiry_date?: string;
};

export type StorageRiskResponse = {
  medicine: Medicine;
  storage_requirements: {
    min_temperature: number;
    max_temperature: number;
    min_humidity: number | null;
    max_humidity: number | null;
    temperature_unit: string;
    regulatory_source: string;
    source_url: string;
    has_quantified_humidity: boolean;
    humidity_monograph_notice: string;
  };
  deterministic_compliance: {
    is_compliant: boolean;
    temp_compliant: boolean;
    temp_deviation: number;
    humidity_compliant: boolean | null;
    humidity_status_text: string;
    summary: string;
  };
  ml_risk: {
    level: RiskLevel;
    confidence: number;
    probabilities: Record<string, number>;
    top_factors: MLFactorImportance[];
    model_name: string;
    model_version: string;
    training_dataset_type: string;
  };
  disclaimer: string;
  evaluated_at: string;
};

export type StorageRiskMetadata = {
  model_name: string;
  model_version: string;
  algorithm: string;
  dataset_type: string;
  features: string[];
  target_classes: string[];
  disclaimer: string;
};

export type VisionTestMetrics = {
  evaluation_dataset?: string;
  sample_count?: number;
  top1_accuracy?: number;
  top3_accuracy?: number;
  macro_precision?: number;
  macro_recall?: number;
  macro_f1?: number;
  per_class?: Record<
    string,
    { precision: number; recall: number; "f1-score": number; support: number }
  >;
  confusion_matrix?: number[][];
  class_names?: string[];
};

export type ModelsOverview = {
  vision: {
    available: boolean;
    model_name: string | null;
    architecture: string | null;
    framework_version: string | null;
    dataset_version: string | null;
    class_count: number | null;
    class_names: string[];
    image_size: number | null;
    confidence_threshold: number | null;
    checkpoint_size_bytes: number | null;
    training_date: string | null;
    hyperparameters: Record<string, unknown>;
    best_val_accuracy: number | null;
    training_history: Array<{
      epoch: number;
      train_loss: number;
      train_acc: number;
      val_loss: number;
      val_acc: number;
    }>;
    test_metrics: VisionTestMetrics;
  };
  storage_risk: {
    available: boolean;
    model_name: string | null;
    model_version: string | null;
    algorithm: string | null;
    dataset_type: string | null;
    trained_at: string | null;
    dataset_samples: number | null;
    splits: Record<string, number>;
    random_seed: number | null;
    features: string[];
    feature_importances: Record<string, number>;
    target_classes: string[];
    model_parameters: Record<string, unknown>;
    validation_comparison: Record<
      string,
      { accuracy: number; macro_f1: number; weighted_f1: number }
    >;
    test_metrics: {
      accuracy?: number;
      macro_precision?: number;
      macro_recall?: number;
      macro_f1?: number;
      weighted_f1?: number;
    };
    confusion_matrix: { matrix?: number[][]; labels?: string[] };
    per_class_metrics: Record<
      string,
      { precision: number; recall: number; f1_score: number; support: number }
    >;
  };
  independent_verification: Record<string, unknown> | null;
  limitations: string[];
  disclaimer: string;
};

/* ------------------------------------------------------------------ *
 * Transport
 * ------------------------------------------------------------------ */

/** Carries the HTTP status so callers can distinguish "not found" from "backend is down". */
export class ApiError extends Error {
  readonly status: number;
  readonly isNetworkError: boolean;

  constructor(message: string, status: number, isNetworkError = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.isNetworkError = isNetworkError;
  }
}

const OFFLINE_HINT =
  `Cannot reach the MediShelf API at ${API_BASE_URL}. Start it with ` +
  `\`python tools/serve_api.py\` from the repository root.`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    // fetch only rejects on transport failure, so this branch means the API is unreachable.
    throw new ApiError(OFFLINE_HINT, 0, true);
  }

  if (!response.ok) {
    let detail = `Request to ${path} failed with HTTP ${response.status}.`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "detail" in body) {
        const raw = (body as { detail: unknown }).detail;
        // FastAPI validation errors arrive as an array of objects.
        detail =
          typeof raw === "string"
            ? raw
            : Array.isArray(raw)
              ? raw
                  .map((entry) =>
                    entry && typeof entry === "object" && "msg" in entry
                      ? String((entry as { msg: unknown }).msg)
                      : JSON.stringify(entry),
                  )
                  .join("; ")
              : JSON.stringify(raw);
      }
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

/* ------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------ */

export const fetchHealth = () => request<SystemHealth>("/api/health");

export type MedicineQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
};

export function fetchMedicines(params: MedicineQuery = {}): Promise<MedicineListResponse> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 1));
  query.set("page_size", String(params.pageSize ?? 25));
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.category?.trim() && params.category !== "ALL") {
    query.set("category", params.category.trim());
  }
  return request<MedicineListResponse>(`/api/medicines?${query.toString()}`);
}

export const fetchCategories = () => request<CategoryCount[]>("/api/medicines/categories");

export const fetchMedicine = (medicineId: string) =>
  request<Medicine>(`/api/medicines/${encodeURIComponent(medicineId)}`);

export function scanMedicineImage(file: File, threshold?: number): Promise<ScanResponse> {
  const body = new FormData();
  body.append("file", file);
  const query = threshold === undefined ? "" : `?threshold=${threshold}`;
  // Content-Type is deliberately omitted so the browser sets the multipart boundary.
  return request<ScanResponse>(`/api/scan${query}`, { method: "POST", body });
}

export const predictStorageRisk = (payload: StorageRiskRequest) =>
  request<StorageRiskResponse>("/api/v1/storage-risk/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const fetchStorageRiskMetadata = () =>
  request<StorageRiskMetadata>("/api/v1/storage-risk/metadata");

export const fetchModelsOverview = () => request<ModelsOverview>("/api/models");

/* ------------------------------------------------------------------ *
 * Presentation helpers
 * ------------------------------------------------------------------ */

/** "humulin_r_100u_vial" -> "Humulin R 100u Vial" */
export function humanizeClassName(className: string): string {
  return className
    .split("_")
    .map((part) => (part.length > 0 ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export const formatPercent = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined ? "—" : `${(value * 100).toFixed(digits)}%`;

export const formatTempRange = (min: number, max: number): string => `${min}–${max}°C`;

export const FUSION_LABELS: Record<IdentificationStatus, string> = {
  CONFIRMED: "Both signals agree",
  PARTIAL: "Partly corroborated",
  DIVERGENT: "Signals disagree",
  UNCONFIRMED: "Not corroborated",
};

export const OCR_STATUS_LABELS: Record<OcrStatus, string> = {
  completed: "Label text read",
  skipped_low_quality: "Skipped — image quality",
  unavailable: "Engine unavailable",
};
