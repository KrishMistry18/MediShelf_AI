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
} from 'lucide-react';
import { scanMedicineImage } from '../services/api';
import type { ScanResponse, StructuredFields } from '../types';

interface ScanPageProps {
  onNavigateToMedicines?: () => void;
}

export const ScanPage: React.FC<ScanPageProps> = ({ onNavigateToMedicines }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(0.60);

  // Manual Corrections State: field_name -> edited_value
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
      setErrorMessage(err instanceof Error ? err.message : 'Scan and OCR pipeline execution failed');
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

  const handleLoadSample = async (samplePath: string, fileName: string) => {
    try {
      setIsScanning(true);
      setErrorMessage(null);
      const res = await fetch(samplePath);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      handleFileSelection(file);
    } catch (err) {
      setErrorMessage(`Failed to load benchmark sample: ${err instanceof Error ? err.message : String(err)}`);
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

  // Helper to render a structured field with manual edit pencil
  const renderFieldRow = (
    label: string,
    fieldKey: keyof StructuredFields,
    fieldObj: any,
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
      <div className="py-2.5 px-3 rounded-xl border border-slate-800/80 bg-slate-950/60 transition hover:border-slate-700">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {label}
          </span>
          <div className="flex items-center gap-1.5">
            {isUserEdited && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                User corrected
              </span>
            )}
            {!isCurrentlyEditing && (
              <button
                type="button"
                onClick={() => startEditing(fieldKey, displayVal)}
                className="p-1 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition"
                title={`Edit ${label}`}
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
              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition"
              title="Save correction"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-xs font-medium ${hasValue ? 'text-white' : 'text-slate-500 italic'}`}>
              {hasValue ? displayVal : 'Not detected'}
            </span>

            {/* Individual Confidence Badges */}
            {hasValue && !isUserEdited && (
              <div className="flex items-center gap-1 text-[10px] font-mono">
                {ocrConf !== null && ocrConf !== undefined && (
                  <span className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded" title="OCR Engine Confidence">
                    OCR: {Math.round(ocrConf * 100)}%
                  </span>
                )}
                {parserConf !== null && parserConf !== undefined && (
                  <span className="text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/20" title="Regex Pattern Confidence">
                    Pattern: {Math.round(parserConf * 100)}%
                  </span>
                )}
                {dbConf !== null && dbConf !== undefined && (
                  <span className="text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20" title="Catalog Match Score">
                    Catalog: {Math.round(dbConf * 100)}%
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
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Medicine Package Scanner & OCR</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-3 h-3" /> Phase 4: CV + Deep OCR
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dual recognition pipeline: MobileNetV3 visual classification + EasyOCR 1.7.2 packaging text parsing with explainable multi-modal fusion.
          </p>
        </div>

        {/* Confidence Threshold Setting */}
        <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 px-3.5 py-2 rounded-xl text-xs">
          <span className="text-slate-400 font-medium">CV Gate:</span>
          <span className="font-mono text-cyan-400 font-bold">{Math.round(threshold * 100)}%</span>
          <input
            type="range"
            min="0.30"
            max="0.95"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-24 accent-cyan-500 cursor-pointer"
            title={`Threshold: ${Math.round(threshold * 100)}%`}
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Capture & Upload Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col items-center justify-center text-center">
            {previewUrl ? (
              <div className="w-full space-y-4">
                <div className="relative mx-auto max-h-80 overflow-hidden rounded-xl border border-slate-700 bg-black flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="Captured medicine packaging"
                    className="max-h-80 w-full object-contain"
                  />
                  {isScanning && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-3 p-4">
                      <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-semibold text-cyan-300">Executing CV Classification & EasyOCR...</p>
                      <p className="text-[11px] text-slate-400">Extracting label typography, dosage, and batch data</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={handleReset}
                    disabled={isScanning}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Change Image
                  </button>

                  <button
                    onClick={handleRunInference}
                    disabled={isScanning}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isScanning ? 'Processing Pipeline...' : 'Run Vision & OCR'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full py-8 px-4 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center space-y-4 hover:border-cyan-500/40 transition">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
                  <Camera className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Capture or Upload Medicine Image</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Take a live photo via mobile camera or select an authentic carton image.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full max-w-xs">
                  {/* Mobile Camera Direct Input */}
                  <label className="flex-1 cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:from-cyan-400 hover:to-teal-400 transition shadow-md shadow-cyan-500/20">
                    <Camera className="h-4 w-4" />
                    <span>Camera</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </label>

                  {/* Desktop Upload Input */}
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

                {/* Quick Test Benchmark Samples (SPL Public Domain) */}
                <div className="w-full pt-4 border-t border-slate-800/80 space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-300">
                      Quick Test with Verified SPL Packaging:
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono">1-Click Test</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadSample('/samples/paracetamol_sample.jpg', 'paracetamol_test.jpg')}
                      className="text-left px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950/80 hover:border-cyan-500/50 hover:bg-slate-900 text-[11px] text-slate-300 transition"
                    >
                      <span className="font-semibold block text-white">Paracetamol 500mg</span>
                      <span className="text-[10px] text-slate-400">Analgesic • 20-25°C</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSample('/samples/humulin_sample.jpg', 'humulin_test.jpg')}
                      className="text-left px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950/80 hover:border-cyan-500/50 hover:bg-slate-900 text-[11px] text-slate-300 transition"
                    >
                      <span className="font-semibold block text-white">Humulin R 100U</span>
                      <span className="text-[10px] text-cyan-400">Cold Chain • 2-8°C</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSample('/samples/atorvastatin_sample.jpg', 'atorvastatin_test.jpg')}
                      className="text-left px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950/80 hover:border-cyan-500/50 hover:bg-slate-900 text-[11px] text-slate-300 transition"
                    >
                      <span className="font-semibold block text-white">Atorvastatin 20mg</span>
                      <span className="text-[10px] text-slate-400">Lipitor • 20-25°C</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSample('/samples/metformin_sample.jpg', 'metformin_test.jpg')}
                      className="text-left px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950/80 hover:border-cyan-500/50 hover:bg-slate-900 text-[11px] text-slate-300 transition"
                    >
                      <span className="font-semibold block text-white">Metformin 500mg</span>
                      <span className="text-[10px] text-slate-400">Glucophage • 20-25°C</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Image Quality Gate Panel (If Scanned) */}
          {scanResult?.quality && (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" /> Pre-OCR Quality Assessment
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  scanResult.quality.is_acceptable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {scanResult.quality.is_acceptable ? 'PASSED' : 'DEGRADED'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1">
                <div>Sharpness: <span className="font-mono text-slate-200">{scanResult.quality.blur_score}</span></div>
                <div>Exposure: <span className="font-mono text-slate-200">{scanResult.quality.mean_brightness}</span></div>
                <div>Resolution: <span className="font-mono text-slate-200">{scanResult.quality.resolution || `${scanResult.quality.width}x${scanResult.quality.height}`}</span></div>
              </div>
              {scanResult.quality.issues.length > 0 && (
                <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-1">
                  {scanResult.quality.issues.map((iss, i) => (
                    <p key={i} className="flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" /> {iss}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Architecture Separation Notice */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4 space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Layers className="h-4 w-4 text-cyan-400" />
              <span>Multi-Modal Pipeline Independence</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Computer vision (MobileNetV3) performs visual carton matching, while EasyOCR reads printed typography independently. 
              The decision fusion layer computes consensus without overwriting raw signals.
            </p>
          </div>
        </div>

        {/* Right Column: Model Output, OCR Fields, Fusion & Storage Specs */}
        <div className="lg:col-span-7 space-y-4">
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Pipeline Execution Error</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {scanResult ? (
            <div className="space-y-4">
              {/* 1. Multi-Modal Fusion Assessment Header Banner */}
              {scanResult.fusion && (
                <div className={`rounded-2xl border p-4 space-y-3 ${
                  scanResult.fusion.identification_status === 'CONFIRMED'
                    ? 'border-emerald-500/30 bg-emerald-950/20'
                    : scanResult.fusion.identification_status === 'PARTIAL'
                    ? 'border-cyan-500/30 bg-cyan-950/20'
                    : scanResult.fusion.identification_status === 'DIVERGENT'
                    ? 'border-amber-500/30 bg-amber-950/20'
                    : 'border-slate-800 bg-slate-900/50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono tracking-wide ${
                        scanResult.fusion.identification_status === 'CONFIRMED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : scanResult.fusion.identification_status === 'PARTIAL'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : scanResult.fusion.identification_status === 'DIVERGENT'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {scanResult.fusion.identification_status} IDENTIFICATION
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Agreement: {Math.round(scanResult.fusion.agreement_score * 100)}%
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {scanResult.inference_time_ms} ms total
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-300">
                    {scanResult.fusion.reasons.map((reason, i) => (
                      <p key={i} className="flex items-start gap-1.5 leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </p>
                    ))}
                  </div>

                  {scanResult.fusion.identification_status !== 'CONFIRMED' && onNavigateToMedicines && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={onNavigateToMedicines}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs text-white font-medium transition cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5" />
                        Search Medicine Catalog Manually
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Structured OCR Extracted Information Card */}
              {scanResult.ocr?.fields && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-sm font-bold text-white">Extracted Packaging Label Information (OCR)</h3>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/20 px-2 py-0.5 rounded">
                      {scanResult.ocr.engine}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {renderFieldRow('Medicine Name', 'medicine_name', scanResult.ocr.fields.medicine_name, 'e.g. Paracetamol 500mg')}
                    {renderFieldRow('Active Ingredient', 'generic_name', scanResult.ocr.fields.generic_name, 'e.g. Acetaminophen')}
                    {renderFieldRow('Dosage Strength', 'strength', scanResult.ocr.fields.strength, 'e.g. 500 mg')}
                    {renderFieldRow('Batch / Lot Number', 'batch_number', scanResult.ocr.fields.batch_number, 'e.g. LOT ABC123')}
                    {renderFieldRow('Expiration Date', 'expiry_date', scanResult.ocr.fields.expiry_date, 'YYYY-MM')}
                    {renderFieldRow('Manufacturing Date', 'manufacturing_date', scanResult.ocr.fields.manufacturing_date, 'YYYY-MM')}
                    <div className="md:col-span-2">
                      {renderFieldRow('Manufacturer', 'manufacturer', scanResult.ocr.fields.manufacturer, 'e.g. GlaxoSmithKline')}
                    </div>
                  </div>

                  {/* Raw OCR Text Toggle */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setShowRawOCR(!showRawOCR)}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {showRawOCR ? 'Hide Raw OCR Lines' : 'View Detected Raw OCR Lines'}
                    </button>

                    {showRawOCR && (
                      <div className="mt-2.5 max-h-40 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-[11px] font-mono text-slate-300 space-y-1">
                        {scanResult.ocr.raw_text.split('\n').map((line, idx) => (
                          <div key={idx} className="leading-snug">{line}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. Computer Vision Predictions Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Scan className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Visual Package Recognition (MobileNetV3-Small)</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    Top-3 Visual Classes
                  </span>
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
                                ? scanResult.is_confident ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-500 to-orange-400'
                                : 'bg-slate-700'
                            }`}
                            style={{ width: `${Math.max(percentage, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Verified Storage Specifications (Database Monograph) */}
              {scanResult.medicine && scanResult.storage_requirements && (
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      Verified Monograph Storage Specifications
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      SKU: {scanResult.medicine.medicine_id}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Thermometer className="w-3 h-3 text-cyan-400" /> Safe Temp Range
                      </span>
                      <p className="font-mono font-bold text-white mt-1">
                        {scanResult.storage_requirements.min_temperature}°C - {scanResult.storage_requirements.max_temperature}°C
                      </p>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400">Dosage Form</span>
                      <p className="font-semibold text-slate-200 mt-1">
                        {scanResult.medicine.dosage_form}
                      </p>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400">Category</span>
                      <p className="font-semibold text-slate-200 mt-1 truncate">
                        {scanResult.medicine.category}
                      </p>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400">Active Ingredient</span>
                      <p className="font-semibold text-slate-200 mt-1 truncate">
                        {scanResult.medicine.generic_name}
                      </p>
                    </div>
                  </div>

                  {/* Regulatory Citation */}
                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-cyan-500/10">
                    <span>Source: {scanResult.storage_requirements.regulatory_source}</span>
                    <a
                      href={scanResult.medicine.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                    >
                      Official Monograph <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Default Idle Card */
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Scan className="h-4 w-4 text-cyan-400" />
                  Dual CV + OCR Pipeline Ready
                </h3>
                <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  Ready for Input
                </span>
              </div>

              <div className="space-y-4 text-xs text-slate-400 leading-relaxed">
                <p>
                  MediShelf AI executes two independent inference streams upon image capture:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1.5">
                    <span className="text-white font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-400" /> Computer Vision Classifier
                    </span>
                    <p className="text-[11px]">MobileNetV3-Small transfer learning recognizing packaging geometry and trade dress.</p>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1.5">
                    <span className="text-white font-semibold flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-400" /> EasyOCR 1.7.2 Pipeline
                    </span>
                    <p className="text-[11px]">Extracts printed expiration dates (YYYY-MM), batch numbers, strength, and active ingredient.</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                  <p className="font-semibold text-slate-300">Phase 4 Engineering Guarantees:</p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                    <li><strong>No Fake Expirations</strong>: Dates without an explicit day are normalized strictly to YYYY-MM.</li>
                    <li><strong>Transparent Confidences</strong>: Discloses OCR engine confidence, regex pattern confidence, and catalog match score.</li>
                    <li><strong>Inline Corrections</strong>: Users can manually edit any OCR field; edits are tagged as "User corrected".</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
