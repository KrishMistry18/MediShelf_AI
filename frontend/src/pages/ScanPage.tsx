import React, { useState } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Scan,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Clock,
  Thermometer,
  Layers,
  FileText,
  Edit2,
  Check,
  X,
  Eye,
  AlertCircle,
  Database,
  Sliders,
} from 'lucide-react';
import { scanMedicineImage } from '../services/api';
import type { ScanResponse, StructuredFields } from '../types';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  SectionHeader,
  StatusBadge,
} from '../components/common';
import { StorageRiskAssessment } from '../components/storage/StorageRiskAssessment';

interface ScanPageProps {
  onNavigateToMedicines?: () => void;
}

interface BenchmarkSample {
  id: string;
  name: string;
  subtitle: string;
  storage: string;
  path: string;
  fileName: string;
}

const BENCHMARK_SAMPLES: BenchmarkSample[] = [
  {
    id: 'paracetamol',
    name: 'Paracetamol 500mg',
    subtitle: 'Analgesic • Solid Oral Tablet',
    storage: '20°C - 25°C • USP Monograph',
    path: '/samples/paracetamol_sample.jpg',
    fileName: 'paracetamol_test.jpg',
  },
  {
    id: 'humulin',
    name: 'Humulin R 100U/mL',
    subtitle: 'Recombinant Insulin • Vial',
    storage: '2°C - 8°C • Cold Chain Required',
    path: '/samples/humulin_sample.jpg',
    fileName: 'humulin_test.jpg',
  },
  {
    id: 'atorvastatin',
    name: 'Atorvastatin 20mg',
    subtitle: 'Lipid Lowering • Film-coated',
    storage: '20°C - 25°C • Controlled Room Temp',
    path: '/samples/atorvastatin_sample.jpg',
    fileName: 'atorvastatin_test.jpg',
  },
  {
    id: 'metformin',
    name: 'Metformin 500mg',
    subtitle: 'Antidiabetic • Biguanide Tablet',
    storage: '20°C - 25°C • Controlled Room Temp',
    path: '/samples/metformin_sample.jpg',
    fileName: 'metformin_test.jpg',
  },
];

export const ScanPage: React.FC<ScanPageProps> = ({ onNavigateToMedicines }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(0.60);

  // Manual Field Corrections: field_name -> edited_value
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editInputValue, setEditInputValue] = useState<string>('');
  const [showRawOCR, setShowRawOCR] = useState<boolean>(false);

  const handleFileSelection = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setScanResult(null);
    setErrorMessage(null);
    setCorrections({});
    setEditingField(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleRunInference = async () => {
    if (!selectedFile) return;

    setIsScanning(true);
    setErrorMessage(null);
    setCorrections({});
    setEditingField(null);

    try {
      const result = await scanMedicineImage(selectedFile, threshold);
      setScanResult(result);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Multi-modal scan and OCR pipeline execution failed'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setScanResult(null);
    setErrorMessage(null);
    setCorrections({});
    setEditingField(null);
  };

  const handleLoadSample = async (sample: BenchmarkSample) => {
    try {
      setIsScanning(true);
      setErrorMessage(null);
      const res = await fetch(sample.path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], sample.fileName, { type: 'image/jpeg' });
      handleFileSelection(file);
    } catch (err) {
      setErrorMessage(
        `Failed to load demonstration sample: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsScanning(false);
    }
  };

  const startEditing = (fieldName: string, currentValue: string | null | undefined) => {
    setEditingField(fieldName);
    setEditInputValue(corrections[fieldName] ?? (currentValue || ''));
  };

  const saveEditing = (fieldName: string) => {
    if (editInputValue.trim()) {
      setCorrections((prev) => ({ ...prev, [fieldName]: editInputValue.trim() }));
    }
    setEditingField(null);
  };

  const cancelEditing = () => {
    setEditingField(null);
  };

  const renderFieldRow = (
    label: string,
    fieldKey: keyof StructuredFields,
    fieldObj: {
      value?: string | null;
      confidence?: {
        ocr_engine_confidence?: number | null;
        parser_confidence?: number | null;
        db_match_confidence?: number | null;
      };
    },
    placeholder: string
  ) => {
    const isUserEdited = corrections[fieldKey] !== undefined;
    const displayVal = isUserEdited ? corrections[fieldKey] : fieldObj?.value;
    const hasValue = displayVal !== null && displayVal !== undefined && displayVal !== '';
    const isCurrentlyEditing = editingField === fieldKey;

    const ocrConf = fieldObj?.confidence?.ocr_engine_confidence;
    const parserConf = fieldObj?.confidence?.parser_confidence;
    const dbConf = fieldObj?.confidence?.db_match_confidence;

    return (
      <div className="py-2.5 px-3 rounded-xl border border-slate-800/80 bg-slate-950/60 transition hover:border-slate-700/80">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-sans">
            {label}
          </span>
          <div className="flex items-center gap-1.5">
            {isUserEdited && (
              <Badge variant="warning" size="sm">
                User corrected
              </Badge>
            )}
            {!isCurrentlyEditing && (
              <button
                type="button"
                onClick={() => startEditing(fieldKey, displayVal)}
                className="p-1 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition cursor-pointer"
                title={`Correct ${label}`}
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {isCurrentlyEditing ? (
          <div className="flex items-center gap-1.5 mt-1">
            <input
              type="text"
              value={editInputValue}
              onChange={(e) => setEditInputValue(e.target.value)}
              className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-cyan-500/60 bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
              placeholder={placeholder}
              autoFocus
            />
            <button
              type="button"
              onClick={() => saveEditing(fieldKey)}
              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
              title="Save correction"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-xs font-medium ${
                hasValue ? 'text-white' : 'text-slate-500 italic'
              }`}
            >
              {hasValue ? displayVal : 'Not detected on package'}
            </span>

            {hasValue && !isUserEdited && (
              <div className="flex items-center gap-1 text-[10px] font-mono shrink-0">
                {ocrConf !== null && ocrConf !== undefined && (
                  <span
                    className="text-slate-400 bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700/60"
                    title="EasyOCR recognition confidence"
                  >
                    OCR {Math.round(ocrConf * 100)}%
                  </span>
                )}
                {parserConf !== null && parserConf !== undefined && (
                  <span
                    className="text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30"
                    title="Regex pattern parser confidence"
                  >
                    Rule {Math.round(parserConf * 100)}%
                  </span>
                )}
                {dbConf !== null && dbConf !== undefined && (
                  <span
                    className="text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30"
                    title="Catalog lexical match score"
                  >
                    DB {Math.round(dbConf * 100)}%
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge={
          <Badge variant="success" size="sm" dot>
            Phase 3 & 4 Active: Computer Vision + EasyOCR Pipeline
          </Badge>
        }
        title="Medicine Packaging Scanner & Label OCR"
        description="Dual-stream intelligence system: MobileNetV3-Small transfer learning visual classifier paired with EasyOCR 1.7.2 text recognition and explainable multi-modal consensus fusion."
        actions={
          <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-3.5 py-2 rounded-xl text-xs">
            <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-slate-300 font-medium font-sans">CV Gate:</span>
            <span className="font-mono text-cyan-400 font-bold">{Math.round(threshold * 100)}%</span>
            <input
              type="range"
              min="0.30"
              max="0.95"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-20 sm:w-24 accent-cyan-500 cursor-pointer"
              title={`Confidence rejection gate: ${Math.round(threshold * 100)}%`}
              aria-label="Confidence gate threshold slider"
            />
          </div>
        }
      />

      {/* Visual Pipeline Progression Flow */}
      <div className="hidden sm:grid grid-cols-6 gap-2 text-center text-xs">
        <div className={`p-2 rounded-xl border ${selectedFile ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300' : 'border-slate-800 bg-slate-900/40 text-slate-400'}`}>
          <div className="font-mono text-[10px] text-slate-500 uppercase">Step 1</div>
          <div className="font-semibold mt-0.5 truncate">Image Input</div>
        </div>
        <div className={`p-2 rounded-xl border ${scanResult?.quality ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300' : 'border-slate-800 bg-slate-900/40 text-slate-400'}`}>
          <div className="font-mono text-[10px] text-slate-500 uppercase">Step 2</div>
          <div className="font-semibold mt-0.5 truncate">Quality Gate</div>
        </div>
        <div className={`p-2 rounded-xl border ${scanResult?.top_predictions ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300' : 'border-slate-800 bg-slate-900/40 text-slate-400'}`}>
          <div className="font-mono text-[10px] text-slate-500 uppercase">Step 3</div>
          <div className="font-semibold mt-0.5 truncate">CV Classifier</div>
        </div>
        <div className={`p-2 rounded-xl border ${scanResult?.ocr ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300' : 'border-slate-800 bg-slate-900/40 text-slate-400'}`}>
          <div className="font-mono text-[10px] text-slate-500 uppercase">Step 4</div>
          <div className="font-semibold mt-0.5 truncate">EasyOCR Label</div>
        </div>
        <div className={`p-2 rounded-xl border ${scanResult?.fusion ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300' : 'border-slate-800 bg-slate-900/40 text-slate-400'}`}>
          <div className="font-mono text-[10px] text-slate-500 uppercase">Step 5</div>
          <div className="font-semibold mt-0.5 truncate">Decision Fusion</div>
        </div>
        <div className={`p-2 rounded-xl border ${scanResult?.storage_requirements ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300' : 'border-slate-800 bg-slate-900/40 text-slate-400'}`}>
          <div className="font-mono text-[10px] text-slate-500 uppercase">Step 6</div>
          <div className="font-semibold mt-0.5 truncate">Storage Monograph</div>
        </div>
      </div>

      {/* Main Two-Column Scan Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Image Acquisition & Pre-Check */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 sm:p-6 text-center">
            {previewUrl ? (
              <div className="w-full space-y-4">
                <div className="relative mx-auto max-h-80 overflow-hidden rounded-xl border border-slate-700 bg-black flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="Captured medicine packaging candidate"
                    className="max-h-80 w-full object-contain"
                  />
                  {isScanning && (
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-3 p-4">
                      <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-semibold text-cyan-300">
                        Running CV Classification & EasyOCR...
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Extracting packaging typography, dosage strength, and monograph match
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5 justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleReset}
                    disabled={isScanning}
                    icon={<RefreshCw className="h-3.5 w-3.5" />}
                  >
                    Change Image
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRunInference}
                    disabled={isScanning}
                    loading={isScanning}
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                  >
                    {isScanning ? 'Processing Pipeline...' : 'Run Vision & OCR'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full py-6 px-3 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center space-y-4 hover:border-cyan-500/40 transition">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Camera className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Capture or Upload Medicine Image</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    Take a clear live photo of the packaging label or upload a JPEG, PNG, or WebP file.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1 w-full max-w-xs">
                  {/* Mobile Camera Input */}
                  <label className="flex-1 cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:from-cyan-400 hover:to-teal-400 transition shadow-md shadow-cyan-500/20">
                    <Camera className="h-4 w-4" />
                    <span>Mobile Camera</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </label>

                  {/* Desktop File Upload */}
                  <label className="flex-1 cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:border-slate-600 transition">
                    <Upload className="h-4 w-4" />
                    <span>Upload File</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Demonstration Samples Header */}
                <div className="w-full pt-4 border-t border-slate-800/80 text-left space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Verified Demonstration Packaging Samples:
                    </span>
                    <Badge variant="info" size="sm">
                      1-Click Demo
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {BENCHMARK_SAMPLES.map((sample) => (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => handleLoadSample(sample)}
                        className="text-left p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/60 hover:border-cyan-500/50 hover:bg-slate-900 transition cursor-pointer group"
                      >
                        <span className="font-semibold block text-xs text-white group-hover:text-cyan-300 transition">
                          {sample.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                          {sample.subtitle}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400/90 block mt-0.5">
                          {sample.storage}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Pre-OCR Image Quality Gate Assessment */}
          {scanResult?.quality && (
            <Card variant="subtle" className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" /> Pre-OCR Quality Assessment Gate
                </span>
                <Badge
                  variant={scanResult.quality.is_acceptable ? 'success' : 'warning'}
                  size="sm"
                  dot
                >
                  {scanResult.quality.is_acceptable ? 'PASSED' : 'DEGRADED'}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                <div>
                  Sharpness:{' '}
                  <span className="font-mono text-slate-200 font-semibold">
                    {scanResult.quality.blur_score}
                  </span>
                </div>
                <div>
                  Exposure:{' '}
                  <span className="font-mono text-slate-200 font-semibold">
                    {scanResult.quality.mean_brightness}
                  </span>
                </div>
                <div>
                  Resolution:{' '}
                  <span className="font-mono text-slate-200 font-semibold">
                    {scanResult.quality.resolution ||
                      `${scanResult.quality.width}x${scanResult.quality.height}`}
                  </span>
                </div>
              </div>

              {scanResult.quality.issues.length > 0 && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px] space-y-1">
                  {scanResult.quality.issues.map((iss, i) => (
                    <p key={i} className="flex items-center gap-1.5 leading-snug">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{iss}</span>
                    </p>
                  ))}
                  {scanResult.quality.recommendations.map((rec, i) => (
                    <p key={`rec-${i}`} className="text-[10px] text-amber-300/80 pl-5">
                      Recommendation: {rec}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Architecture Separation Principle Box */}
          <Card variant="subtle" className="p-4 space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Layers className="h-4 w-4 text-cyan-400" />
              <span>Multi-Modal Architecture Separation</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              MobileNetV3 processes visual trade dress and carton geometry, while EasyOCR reads printed typography independently. 
              The decision fusion layer computes consensus without fabricating database facts.
            </p>
          </Card>
        </div>

        {/* Right Column: Inferences, Fields, Consensus & Monograph */}
        <div className="lg:col-span-7 space-y-4">
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Pipeline Execution Error</p>
                <p className="mt-0.5 text-rose-200/90 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {scanResult ? (
            <div className="space-y-4">
              {/* 1. Multi-Modal Fusion Assessment Header Banner */}
              {scanResult.fusion && (
                <div
                  className={`rounded-2xl border p-5 space-y-3.5 transition ${
                    scanResult.fusion.identification_status === 'CONFIRMED'
                      ? 'border-emerald-500/40 bg-emerald-950/20'
                      : scanResult.fusion.identification_status === 'PARTIAL'
                      ? 'border-cyan-500/40 bg-cyan-950/20'
                      : scanResult.fusion.identification_status === 'DIVERGENT'
                      ? 'border-amber-500/40 bg-amber-950/20'
                      : 'border-slate-800 bg-slate-900/60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <StatusBadge
                        status={scanResult.fusion.identification_status}
                        size="md"
                      />
                      <span className="text-xs font-semibold text-white tracking-tight">
                        Multi-Modal Decision Consensus
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                      <span>Agreement: {Math.round(scanResult.fusion.agreement_score * 100)}%</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        {scanResult.inference_time_ms} ms
                      </span>
                    </div>
                  </div>

                  {/* Explainable Consensus Points */}
                  <div className="space-y-1.5 text-xs text-slate-300">
                    {scanResult.fusion.reasons.map((reason, i) => (
                      <p key={i} className="flex items-start gap-2 leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </p>
                    ))}
                  </div>

                  {/* Fallback to Manual Catalog Lookup on Low-Confidence or Divergent cases */}
                  {scanResult.fusion.identification_status !== 'CONFIRMED' && onNavigateToMedicines && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Identification not fully confirmed. Verify against verified catalog:
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onNavigateToMedicines}
                        icon={<Search className="w-3.5 h-3.5 text-cyan-400" />}
                      >
                        Search Catalog
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Structured Packaging Information (OCR) */}
              {scanResult.ocr?.fields && (
                <Card className="p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <SectionHeader
                      icon={<FileText className="w-4 h-4 text-cyan-400" />}
                      title="Extracted Packaging Label Information (OCR)"
                    />
                    <Badge variant="info" size="sm">
                      {scanResult.ocr.engine}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {renderFieldRow(
                      'Medicine Name',
                      'medicine_name',
                      scanResult.ocr.fields.medicine_name,
                      'e.g. Paracetamol 500mg'
                    )}
                    {renderFieldRow(
                      'Active Ingredient (API)',
                      'generic_name',
                      scanResult.ocr.fields.generic_name,
                      'e.g. Acetaminophen'
                    )}
                    {renderFieldRow(
                      'Dosage Strength',
                      'strength',
                      scanResult.ocr.fields.strength,
                      'e.g. 500 mg'
                    )}
                    {renderFieldRow(
                      'Batch / Lot Number',
                      'batch_number',
                      scanResult.ocr.fields.batch_number,
                      'e.g. LOT ABC123'
                    )}
                    {renderFieldRow(
                      'Expiration Date (Strict YYYY-MM)',
                      'expiry_date',
                      scanResult.ocr.fields.expiry_date,
                      'YYYY-MM'
                    )}
                    {renderFieldRow(
                      'Manufacturing Date',
                      'manufacturing_date',
                      scanResult.ocr.fields.manufacturing_date,
                      'YYYY-MM'
                    )}
                    <div className="md:col-span-2">
                      {renderFieldRow(
                        'Manufacturer',
                        'manufacturer',
                        scanResult.ocr.fields.manufacturer,
                        'e.g. GlaxoSmithKline'
                      )}
                    </div>
                  </div>

                  {/* Raw OCR Text Toggle */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setShowRawOCR(!showRawOCR)}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 font-medium transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{showRawOCR ? 'Hide Raw OCR Lines' : 'View Detected Raw OCR Lines'}</span>
                    </button>

                    {showRawOCR && (
                      <div className="mt-2.5 max-h-40 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-[11px] font-mono text-slate-300 space-y-1">
                        {scanResult.ocr.raw_text ? (
                          scanResult.ocr.raw_text.split('\n').map((line, idx) => (
                            <div key={idx} className="leading-snug text-slate-300">
                              {line}
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-500 italic">No readable text detected by OCR engine</div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* 3. Computer Vision Predictions Card */}
              <Card className="p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <SectionHeader
                    icon={<Scan className="w-4 h-4 text-emerald-400" />}
                    title="Visual Package Classifier (MobileNetV3-Small)"
                  />
                  <Badge variant="neutral" size="sm">
                    Top-3 Ranked Classes
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {scanResult.top_predictions.map((pred, index) => {
                    const percentage = Math.round(pred.confidence * 100);
                    return (
                      <div key={pred.class_name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-200">
                            #{index + 1} {pred.medicine_name || pred.class_name}
                          </span>
                          <span className="font-mono text-cyan-400 font-semibold">
                            {(pred.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              index === 0
                                ? scanResult.is_confident
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                  : 'bg-gradient-to-r from-amber-500 to-orange-400'
                                : 'bg-slate-700'
                            }`}
                            style={{ width: `${Math.max(percentage, 3)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* 4. Verified Pharmaceutical Storage Monograph (Database Reference) */}
              {scanResult.medicine && scanResult.storage_requirements && (
                <Card variant="accent" className="p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-cyan-200">
                        Verified Pharmaceutical Storage Monograph (Official Database Fact)
                      </span>
                    </div>
                    <Badge variant="info" size="sm" className="font-mono">
                      SKU: {scanResult.medicine.medicine_id}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                        <Thermometer className="w-3 h-3 text-cyan-400" /> Permissible Range
                      </span>
                      <p className="font-mono font-bold text-white mt-1">
                        {scanResult.storage_requirements.min_temperature}°C –{' '}
                        {scanResult.storage_requirements.max_temperature}°C
                      </p>
                    </div>

                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 font-medium">Dosage Form</span>
                      <p className="font-semibold text-slate-200 mt-1 truncate">
                        {scanResult.medicine.dosage_form}
                      </p>
                    </div>

                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 font-medium">Therapeutic Category</span>
                      <p className="font-semibold text-slate-200 mt-1 truncate">
                        {scanResult.medicine.category}
                      </p>
                    </div>

                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 font-medium">Active API</span>
                      <p className="font-semibold text-slate-200 mt-1 truncate">
                        {scanResult.medicine.generic_name}
                      </p>
                    </div>
                  </div>

                  {/* Provenance & Citation Notice */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] text-slate-400 border-t border-cyan-500/15">
                    <span>
                      Monograph Authority: <strong className="text-slate-300">{scanResult.storage_requirements.regulatory_source}</strong>
                    </span>
                    <a
                      href={scanResult.medicine.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-medium"
                    >
                      Official NIH DailyMed Monograph <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </Card>
              )}

              {/* 5. Phase 5: Storage Risk AI/ML Assessment */}
              {scanResult.medicine && (
                <StorageRiskAssessment
                  medicineId={scanResult.medicine.medicine_id}
                  medicineName={scanResult.medicine.medicine_name}
                  initialExpiryDate={corrections['expiry_date'] || scanResult.ocr?.fields?.expiry_date?.value || undefined}
                />
              )}
            </div>
          ) : (
            /* Idle Ready State */
            <Card className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <SectionHeader
                  icon={<Scan className="h-4 w-4 text-cyan-400" />}
                  title="Multi-Modal Vision & OCR Pipeline Ready"
                />
                <Badge variant="info" size="sm" dot>
                  Ready for Input
                </Badge>
              </div>

              <div className="space-y-4 text-xs text-slate-400 leading-relaxed">
                <p>
                  MediShelf AI executes two independent inference streams upon capturing medicine packaging:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1.5">
                    <span className="text-white font-semibold flex items-center gap-1.5 text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Computer Vision Classifier
                    </span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      MobileNetV3-Small transfer learning recognizing packaging geometry and physical trade dress.
                    </p>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1.5">
                    <span className="text-white font-semibold flex items-center gap-1.5 text-xs">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" /> EasyOCR 1.7.2 Pipeline
                    </span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      CRAFT + CRNN deep text recognition parsing printed expiration dates, batch numbers, and active ingredients.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                  <p className="font-semibold text-slate-300 text-xs">
                    Engineering Standards & Transparency Guarantees:
                  </p>
                  <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-slate-400">
                    <li>
                      <strong>No Expiration Hallucinations</strong>: Expiry dates without an explicit printed day are strictly normalized to <code className="text-cyan-300">YYYY-MM</code> format.
                    </li>
                    <li>
                      <strong>Independent Decision Fusion</strong>: Computes consensus agreement without allowing visual guesswork to overwrite printed label facts.
                    </li>
                    <li>
                      <strong>Inline Field Auditing</strong>: Any detected field can be corrected; user corrections are prominently badged with <code className="text-amber-300">User corrected</code>.
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
