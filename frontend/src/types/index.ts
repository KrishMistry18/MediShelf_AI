export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'error' | 'loading';
  version: string;
  project_name: string;
  environment: string;
  database: string;
  timestamp: string;
  disclaimer: string;
  details?: Record<string, unknown> | null;
}

export type TabKey = 'overview' | 'monitoring' | 'medicines' | 'scan' | 'alerts' | 'models';

export interface Medicine {
  id: number;
  medicine_id: string;
  medicine_name: string;
  generic_name: string;
  brand_name?: string | null;
  strength: string;
  dosage_form: string;
  category: string;
  manufacturer?: string | null;
  storage_min_temperature: number;
  storage_max_temperature: number;
  storage_min_humidity?: number | null;
  storage_max_humidity?: number | null;
  expiry_warning_days: number;
  image_class: string;
  source: string;
  source_url: string;
  created_at: string;
  updated_at: string;
}

export interface MedicineListResponse {
  items: Medicine[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface MedicineSummary {
  id: string;
  name: string;
  genericName: string;
  category: string;
  expiryDate: string;
  minTemp: number;
  maxTemp: number;
  minHumidity: number;
  maxHumidity: number;
  status: 'SAFE' | 'WARNING' | 'HIGH_RISK' | 'EXPIRED';
  currentTemp?: number;
  currentHumidity?: number;
}

export interface MetricCardData {
  title: string;
  value: string | number;
  subtitle: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  statusColor?: 'emerald' | 'amber' | 'rose' | 'cyan' | 'indigo';
}

export interface PredictionItem {
  class_name: string;
  confidence: number;
  medicine_id?: string | null;
  medicine_name?: string | null;
}

export interface StorageRequirementsSummary {
  min_temperature: number;
  max_temperature: number;
  min_humidity?: number | null;
  max_humidity?: number | null;
  temperature_unit: string;
  regulatory_source: string;
}

export interface ImageQualityAssessment {
  is_acceptable: boolean;
  blur_score: number;
  mean_brightness: number;
  width: number;
  height: number;
  resolution?: string;
  issues: string[];
  recommendations: string[];
}

export interface OCRTextLine {
  text: string;
  confidence: number;
  bounding_box: number[][];
}

export interface ConfidenceBreakdown {
  ocr_engine_confidence?: number | null;
  parser_confidence?: number | null;
  db_match_confidence?: number | null;
}

export interface ExtractedField {
  field_name?: string | null;
  value?: string | null;
  raw_text?: string | null;
  original_text?: string | null;
  ocr_engine_confidence?: number | null;
  parser_confidence?: number | null;
  db_match_confidence?: number | null;
  confidence: ConfidenceBreakdown;
  is_user_corrected?: boolean;
}

export interface StructuredFields {
  medicine_name: ExtractedField;
  generic_name: ExtractedField;
  strength: ExtractedField;
  dosage_form?: ExtractedField;
  batch_number: ExtractedField;
  expiry_date: ExtractedField;
  manufacturing_date: ExtractedField;
  manufacturer: ExtractedField;
}

export interface CandidateMatch {
  medicine_id: string;
  medicine_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  similarity_score: number;
  matched_token: string;
}

export interface FusionAssessment {
  identification_status: 'CONFIRMED' | 'PARTIAL' | 'DIVERGENT' | 'UNCONFIRMED';
  agreement_score: number;
  cv_prediction?: string | null;
  ocr_match?: string | null;
  strength_match: boolean;
  dosage_form_match?: boolean | null;
  reasons: string[];
}

export interface RecognitionSummary {
  predicted_class: string;
  confidence: number;
  confidence_threshold: number;
  is_confident: boolean;
  top_predictions: PredictionItem[];
}

export interface OCRSummary {
  raw_text: string;
  fields: StructuredFields;
  engine: string;
  candidate_matches: CandidateMatch[];
}

export interface OCRResponse {
  quality: ImageQualityAssessment;
  raw_text: string;
  lines: OCRTextLine[];
  fields: StructuredFields;
  candidate_matches: CandidateMatch[];
  inference_time_ms: number;
  engine: string;
}

export interface ScanResponse {
  recognized: boolean;
  is_confident: boolean;
  confidence: number;
  confidence_threshold: number;
  predicted_class: string;
  top_predictions: PredictionItem[];
  recognition?: RecognitionSummary | null;
  ocr?: OCRSummary | null;
  fusion?: FusionAssessment | null;
  quality?: ImageQualityAssessment | null;
  medicine?: Medicine | null;
  storage_requirements?: StorageRequirementsSummary | null;
  ocr_status: string;
  inference_time_ms: number;
  message: string;
}

// Phase 5: Storage Risk ML Types
export interface StorageRiskRequest {
  medicine_id: string;
  current_temperature: number;
  current_humidity?: number | null;
  excursion_duration_hours?: number;
  days_to_expiry?: number | null;
  expiry_date?: string | null;
}

export interface StorageRequirementsInfo {
  min_temperature: number;
  max_temperature: number;
  min_humidity?: number | null;
  max_humidity?: number | null;
  temperature_unit: string;
  regulatory_source: string;
  source_url: string;
  has_quantified_humidity: boolean;
  humidity_monograph_notice: string;
}

export interface DeterministicCompliance {
  is_compliant: boolean;
  temp_compliant: boolean;
  temp_deviation: number;
  humidity_compliant?: boolean | null;
  humidity_status_text: string;
  summary: string;
}

export interface MLFactorImportance {
  feature: string;
  feature_label: string;
  importance_weight: number;
  observed_value: string | number;
  interpretation: string;
}

export interface MLRiskPrediction {
  level: 'LOW' | 'MODERATE' | 'HIGH';
  confidence: number;
  probabilities: {
    LOW: number;
    MODERATE: number;
    HIGH: number;
    [key: string]: number;
  };
  top_factors: MLFactorImportance[];
  model_name: string;
  model_version: string;
  training_dataset_type: string;
}

export interface StorageRiskResponse {
  medicine: Medicine;
  storage_requirements: StorageRequirementsInfo;
  deterministic_compliance: DeterministicCompliance;
  ml_risk: MLRiskPrediction;
  disclaimer: string;
  evaluated_at: string;
}

export interface ModelMetadataResponse {
  model_name: string;
  model_version: string;
  algorithm: string;
  dataset_type: string;
  features: string[];
  target_classes: string[];
  disclaimer: string;
}

