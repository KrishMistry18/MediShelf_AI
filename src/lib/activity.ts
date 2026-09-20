/**
 * Local record of what this browser session actually did.
 *
 * The Overview and Alerts pages previously displayed invented scan results and alerts. They
 * now read from here, so an empty session shows an empty state rather than fabricated data.
 *
 * Storage is deliberately sessionStorage, not a server table: these are scratch results from
 * manually entered scenarios, not audited telemetry, and they should not outlive the tab.
 */

import { useSyncExternalStore } from "react";
import type {
  IdentificationStatus,
  OcrStatus,
  RiskLevel,
  ScanResponse,
  StorageRiskResponse,
} from "./api";

const SCAN_KEY = "medishelf.activity.scans.v1";
const ASSESSMENT_KEY = "medishelf.activity.assessments.v1";
const MAX_ENTRIES = 12;

export type ScanRecord = {
  id: string;
  at: string;
  fileName: string;
  predictedClass: string;
  medicineName: string | null;
  medicineId: string | null;
  confidence: number;
  threshold: number;
  isConfident: boolean;
  recognized: boolean;
  fusionStatus: IdentificationStatus | null;
  agreementScore: number | null;
  ocrStatus: OcrStatus;
  qualityAcceptable: boolean;
  latencyMs: number;
  batchNumber: string | null;
  expiryDate: string | null;
  storageRange: string | null;
};

export type AssessmentRecord = {
  id: string;
  at: string;
  medicineId: string;
  medicineName: string;
  temperature: number;
  humidity: number | null;
  durationHours: number;
  daysToExpiry: number | null;
  permittedRange: string;
  isCompliant: boolean;
  tempCompliant: boolean;
  tempDeviation: number;
  riskLevel: RiskLevel;
  riskConfidence: number;
};

type Listener = () => void;

const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    // Corrupt or blocked storage should never break rendering.
    return [];
  }
}

function write<T>(key: string, entries: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Private-browsing quota errors are not worth surfacing.
  }
  emit();
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ----------------------------- scans ----------------------------- */

export function recordScan(fileName: string, result: ScanResponse): ScanRecord {
  const record: ScanRecord = {
    id: newId(),
    at: new Date().toISOString(),
    fileName,
    predictedClass: result.predicted_class,
    medicineName: result.medicine?.medicine_name ?? null,
    medicineId: result.medicine?.medicine_id ?? null,
    confidence: result.confidence,
    threshold: result.confidence_threshold,
    isConfident: result.is_confident,
    recognized: result.recognized,
    fusionStatus: result.fusion?.identification_status ?? null,
    agreementScore: result.fusion?.agreement_score ?? null,
    ocrStatus: result.ocr_status,
    qualityAcceptable: result.quality?.is_acceptable ?? false,
    latencyMs: result.inference_time_ms,
    batchNumber: result.ocr?.fields.batch_number.value ?? null,
    expiryDate: result.ocr?.fields.expiry_date.value ?? null,
    storageRange: result.storage_requirements
      ? `${result.storage_requirements.min_temperature}–${result.storage_requirements.max_temperature}°C`
      : null,
  };

  write(SCAN_KEY, [record, ...read<ScanRecord>(SCAN_KEY)]);
  return record;
}

export const getScans = (): ScanRecord[] => read<ScanRecord>(SCAN_KEY);

/* -------------------------- assessments -------------------------- */

export function recordAssessment(
  request: {
    temperature: number;
    humidity: number | null;
    durationHours: number;
    daysToExpiry: number | null;
  },
  result: StorageRiskResponse,
): AssessmentRecord {
  const record: AssessmentRecord = {
    id: newId(),
    at: new Date().toISOString(),
    medicineId: result.medicine.medicine_id,
    medicineName: result.medicine.medicine_name,
    temperature: request.temperature,
    humidity: request.humidity,
    durationHours: request.durationHours,
    daysToExpiry: request.daysToExpiry,
    permittedRange: `${result.storage_requirements.min_temperature}–${result.storage_requirements.max_temperature}°C`,
    isCompliant: result.deterministic_compliance.is_compliant,
    tempCompliant: result.deterministic_compliance.temp_compliant,
    tempDeviation: result.deterministic_compliance.temp_deviation,
    riskLevel: result.ml_risk.level,
    riskConfidence: result.ml_risk.confidence,
  };

  write(ASSESSMENT_KEY, [record, ...read<AssessmentRecord>(ASSESSMENT_KEY)]);
  return record;
}

export const getAssessments = (): AssessmentRecord[] => read<AssessmentRecord>(ASSESSMENT_KEY);

/**
 * An assessment is worth flagging when the documented limits were breached or the model
 * estimated above-LOW degradation risk. Those two conditions are independent on purpose:
 * a brief excursion is non-compliant yet still scores LOW risk.
 */
export const isFlagged = (record: AssessmentRecord): boolean =>
  !record.isCompliant || record.riskLevel !== "LOW";

export const getFlaggedAssessments = (): AssessmentRecord[] => getAssessments().filter(isFlagged);

export function clearActivity(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SCAN_KEY);
  window.sessionStorage.removeItem(ASSESSMENT_KEY);
  emit();
}

/* ---------------------------- reactivity ---------------------------- */

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Keep duplicate tabs of the same app in sync.
  const onStorage = () => listener();
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: never[] = [];

/**
 * Subscribes a component to session activity.
 *
 * `getSnapshot` must return a referentially stable value between writes or React will loop,
 * so the reads are cached and only invalidated when `emit()` fires.
 */
function createSnapshotHook<T>(reader: () => T[]) {
  let cache: T[] | null = null;
  let cacheVersion = -1;
  let version = 0;

  listeners.add(() => {
    version += 1;
  });

  return function useSnapshot(): T[] {
    return useSyncExternalStore(
      subscribe,
      () => {
        if (cache === null || cacheVersion !== version) {
          cache = reader();
          cacheVersion = version;
        }
        return cache;
      },
      // Server render has no sessionStorage; start empty and hydrate on the client.
      () => EMPTY,
    );
  };
}

export const useScanHistory = createSnapshotHook<ScanRecord>(getScans);
export const useAssessmentHistory = createSnapshotHook<AssessmentRecord>(getAssessments);
