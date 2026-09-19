import React, { useState, useEffect } from 'react';
import {
  Thermometer,
  Droplets,
  Clock,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  Brain,
  Info,
  Database,
  Layers,
  Sparkles,
} from 'lucide-react';
import { predictStorageRisk } from '../../services/api';
import type { StorageRiskResponse } from '../../types';
import {
  Badge,
  Button,
  Card,
  Input,
} from '../common';

interface StorageRiskAssessmentProps {
  medicineId: string;
  medicineName?: string;
  initialTemp?: number;
  initialHumidity?: number;
  initialExpiryDate?: string;
  className?: string;
}

export const StorageRiskAssessment: React.FC<StorageRiskAssessmentProps> = ({
  medicineId,
  medicineName,
  initialTemp = 22.0,
  initialHumidity = 50.0,
  initialExpiryDate = '',
  className = '',
}) => {
  const [temperature, setTemperature] = useState<number>(initialTemp);
  const [humidity, setHumidity] = useState<number>(initialHumidity);
  const [durationHours, setDurationHours] = useState<number>(0);
  const [expiryDate, setExpiryDate] = useState<string>(initialExpiryDate);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<StorageRiskResponse | null>(null);

  // Sync initial expiry date if updated externally (e.g. from OCR extraction)
  useEffect(() => {
    if (initialExpiryDate) {
      setExpiryDate(initialExpiryDate);
    }
  }, [initialExpiryDate]);

  // Handle preset scenarios
  const applyPreset = (presetTemp: number, presetDuration: number) => {
    setTemperature(presetTemp);
    setDurationHours(presetDuration);
    setError(null);
  };

  const handleEvaluate = async () => {
    if (!medicineId) {
      setError('Please select or scan a valid medicine first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await predictStorageRisk({
        medicine_id: medicineId,
        current_temperature: temperature,
        current_humidity: humidity,
        excursion_duration_hours: durationHours,
        expiry_date: expiryDate.trim() || undefined,
      });
      setAssessment(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Storage risk assessment request failed');
    } finally {
      setLoading(false);
    }
  };

  // Color mapping for ML risk levels
  const getRiskBadgeVariant = (level: string): 'success' | 'warning' | 'danger' | 'neutral' => {
    switch (level) {
      case 'LOW':
        return 'success';
      case 'MODERATE':
        return 'warning';
      case 'HIGH':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  return (
    <Card variant="accent" className={`p-5 sm:p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Storage-Risk AI Assessment (Phase 5)
            </h3>
            <Badge variant="info" size="sm">
              ML Model Active
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Evaluates ambient temperature and exposure duration against verified monograph limits using a trained{' '}
            <strong className="text-slate-300">GradientBoosting</strong> degradation risk classifier.
          </p>
        </div>

        {medicineName && (
          <Badge variant="neutral" size="sm" className="font-mono text-cyan-300 self-start sm:self-auto">
            SKU: {medicineId} • {medicineName}
          </Badge>
        )}
      </div>

      {/* Preset Quick Scenarios */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Simulated Environmental Presets:
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => applyPreset(22.0, 0)}
          >
            Nominal Room (22°C, 0h)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => applyPreset(30.0, 8)}
          >
            Warm Room (30°C, 8h)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => applyPreset(42.0, 14)}
          >
            Car Trunk Heatwave (42°C, 14h)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => applyPreset(14.0, 12)}
          >
            Cold-Chain Breach (14°C, 12h)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => applyPreset(-2.0, 6)}
          >
            Sub-Zero Freeze (-2°C, 6h)
          </Button>
        </div>
      </div>

      {/* Environmental Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
        {/* Temperature Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-cyan-400" /> Temperature (°C)
            </span>
            <span className="font-mono font-bold text-cyan-400">{temperature}°C</span>
          </label>
          <Input
            type="number"
            step="0.5"
            min="-20"
            max="60"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
            className="w-full text-sm font-mono"
          />
          <input
            type="range"
            min="-10"
            max="50"
            step="0.5"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Excursion Duration Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Excursion Duration
            </span>
            <span className="font-mono font-bold text-amber-400">{durationHours}h</span>
          </label>
          <Input
            type="number"
            step="1"
            min="0"
            max="168"
            value={durationHours}
            onChange={(e) => setDurationHours(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-full text-sm font-mono"
          />
          <input
            type="range"
            min="0"
            max="72"
            step="1"
            value={durationHours}
            onChange={(e) => setDurationHours(parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>

        {/* Relative Humidity Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-emerald-400" /> Relative Humidity
            </span>
            <span className="font-mono font-bold text-emerald-400">{humidity}%</span>
          </label>
          <Input
            type="number"
            step="1"
            min="10"
            max="95"
            value={humidity}
            onChange={(e) => setHumidity(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
            className="w-full text-sm font-mono"
          />
          <span className="text-[10px] text-slate-500 block truncate">
            Ambient hygrometry context
          </span>
        </div>

        {/* Expiration Date Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Expiration Date
          </label>
          <Input
            type="text"
            placeholder="YYYY-MM (e.g. 2027-06)"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full text-sm font-mono"
          />
          <span className="text-[10px] text-slate-500 block">
            Parsed from OCR or packaging
          </span>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Deterministic compliance and ML degradation risk are computed independently.</span>
        </div>

        <Button
          variant="primary"
          onClick={handleEvaluate}
          disabled={loading || !medicineId}
          className="shrink-0"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
              Evaluating...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Run Storage-Risk Model
            </span>
          )}
        </Button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {assessment && (
        <div className="space-y-4 pt-2">
          {/* 3-Pillar Assessment Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pillar 1: Verified Storage Monograph Facts */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-cyan-400" /> 1. Monograph Limits
                  </span>
                  <Badge variant="info" size="sm">
                    Official Database
                  </Badge>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Permissible Temp:</span>
                    <span className="font-mono font-bold text-white">
                      {assessment.storage_requirements.min_temperature}°C –{' '}
                      {assessment.storage_requirements.max_temperature}°C
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Cold Chain Required:</span>
                    <span className="font-semibold text-slate-200">
                      {assessment.storage_requirements.max_temperature <= 8 ? 'Yes (2°C - 8°C)' : 'No (Ambient)'}
                    </span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <span className="text-slate-400 block text-[11px]">Humidity Mandate:</span>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      {assessment.storage_requirements.humidity_monograph_notice}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-500 border-t border-slate-800/80">
                Source: <strong className="text-slate-400">{assessment.storage_requirements.regulatory_source}</strong>
              </div>
            </div>

            {/* Pillar 2: Deterministic Compliance Check */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 2. Boundary Compliance
                  </span>
                  <Badge variant="neutral" size="sm">
                    Rule-Based Check
                  </Badge>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Temperature Status:</span>
                    <Badge
                      variant={assessment.deterministic_compliance.temp_compliant ? 'success' : 'danger'}
                      size="sm"
                    >
                      {assessment.deterministic_compliance.temp_compliant
                        ? 'Within Monograph Range'
                        : `Excursion (${assessment.deterministic_compliance.temp_deviation}°C)`}
                    </Badge>
                  </div>

                  <div className="space-y-1 pt-1">
                    <span className="text-slate-400 block text-[11px]">Compliance Summary:</span>
                    <p className="text-[11px] text-slate-300 leading-tight bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                      {assessment.deterministic_compliance.summary}
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-400 pt-1">
                    <span className="font-semibold text-slate-400">Humidity Evaluation:</span>{' '}
                    {assessment.deterministic_compliance.humidity_status_text}
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-500 border-t border-slate-800/80">
                Method: Exact monograph threshold comparison
              </div>
            </div>

            {/* Pillar 3: AI/ML Storage Risk Model Output */}
            <div className="bg-slate-900/90 border border-cyan-500/30 p-4 rounded-xl space-y-3 flex flex-col justify-between shadow-lg shadow-cyan-950/20">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                  <span className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> 3. ML Risk Prediction
                  </span>
                  <Badge
                    variant={getRiskBadgeVariant(assessment.ml_risk.level)}
                    size="sm"
                    className="font-bold tracking-wider"
                  >
                    {assessment.ml_risk.level} RISK
                  </Badge>
                </div>

                {/* Confidence & Probabilities */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300">Model Confidence:</span>
                    <span className="font-mono font-bold text-cyan-300">
                      {(assessment.ml_risk.confidence * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Probability Distribution Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Low: {(assessment.ml_risk.probabilities.LOW * 100).toFixed(0)}%</span>
                      <span>Mod: {(assessment.ml_risk.probabilities.MODERATE * 100).toFixed(0)}%</span>
                      <span>High: {(assessment.ml_risk.probabilities.HIGH * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-500"
                        style={{ width: `${assessment.ml_risk.probabilities.LOW * 100}%` }}
                      />
                      <div
                        className="bg-amber-500 h-full transition-all duration-500"
                        style={{ width: `${assessment.ml_risk.probabilities.MODERATE * 100}%` }}
                      />
                      <div
                        className="bg-rose-500 h-full transition-all duration-500"
                        style={{ width: `${assessment.ml_risk.probabilities.HIGH * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-400 border-t border-cyan-500/20 flex justify-between">
                <span>Algorithm: <strong className="text-slate-300">{assessment.ml_risk.model_name}</strong></span>
                <span className="text-cyan-400 font-mono">{assessment.ml_risk.model_version}</span>
              </div>
            </div>
          </div>

          {/* Feature Explainability / Contributing Factors */}
          {assessment.ml_risk.top_factors && assessment.ml_risk.top_factors.length > 0 && (
            <Card className="p-4 space-y-3 bg-slate-950/70 border-slate-800/80">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" /> Primary Contributing Factors (Explainability)
                </span>
                <span className="text-[11px] text-slate-400">Relative Feature Weights</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {assessment.ml_risk.top_factors.map((factor) => (
                  <div
                    key={factor.feature}
                    className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1 text-xs"
                  >
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-medium truncate">{factor.feature_label}</span>
                      <span className="font-mono text-cyan-400 text-[11px] shrink-0">
                        {(factor.importance_weight * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {factor.interpretation}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Scientific Disclaimer */}
          <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-950/20 text-slate-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px] text-slate-300">
              <strong>Regulatory & Clinical Disclaimer</strong>: {assessment.disclaimer}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};
