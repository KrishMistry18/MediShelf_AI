import React from 'react';
import {
  BarChart2,
  AlertTriangle,
  Clock,
  Scan,
  Info,
  Layers,
} from 'lucide-react';
import {
  Badge,
  Card,
  PageHeader,
  SectionHeader,
  StatCard,
} from '../components/common';

export const ModelAnalyticsPage: React.FC = () => {
  // Authentic Phase 3 evaluation benchmark metrics from ml/artifacts/metrics/test_metrics.json
  const benchmarkMetrics = {
    top1Accuracy: '50.0%',
    top3Accuracy: '80.0%',
    macroPrecision: '0.4000',
    macroRecall: '0.5000',
    macroF1: '0.4333',
    weightedF1: '0.4333',
    sampleCount: 10,
    testDistribution: '1 sample per class (10 core classes)',
  };

  const perClassResults = [
    { className: 'Paracetamol 500mg Tablet', precision: '1.00', recall: '1.00', f1: '1.00', status: 'Recognized' },
    { className: 'Humulin R 100U Vial', precision: '1.00', recall: '1.00', f1: '1.00', status: 'Recognized' },
    { className: 'Atorvastatin 20mg Tablet', precision: '1.00', recall: '1.00', f1: '1.00', status: 'Recognized' },
    { className: 'Metformin 500mg Tablet', precision: '0.50', recall: '1.00', f1: '0.67', status: 'Partial' },
    { className: 'Ibuprofen 400mg Tablet', precision: '0.50', recall: '1.00', f1: '0.67', status: 'Partial' },
    { className: 'Amoxicillin 500mg Capsule', precision: '0.00', recall: '0.00', f1: '0.00', status: 'Misclassified' },
    { className: 'Cetirizine 10mg Tablet', precision: '0.00', recall: '0.00', f1: '0.00', status: 'Misclassified' },
    { className: 'Ciprofloxacin 500mg Tablet', precision: '0.00', recall: '0.00', f1: '0.00', status: 'Misclassified' },
    { className: 'Losartan 50mg Tablet', precision: '0.00', recall: '0.00', f1: '0.00', status: 'Misclassified' },
    { className: 'Omeprazole 20mg Capsule', precision: '0.00', recall: '0.00', f1: '0.00', status: 'Misclassified' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge={
          <Badge variant="info" size="sm" dot>
            Phase 3 Empirical Benchmark Report
          </Badge>
        }
        title="AI/ML Model Benchmarks & Academic Evaluation"
        description="Standardized evaluation metrics, model architecture benchmarks, and training methodology. Figures reflect authentic isolated test split evaluations on authentic NIH DailyMed SPL packaging."
      />

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Top-1 Accuracy"
          value={benchmarkMetrics.top1Accuracy}
          subtitle="Primary class match"
          theme="cyan"
        />
        <StatCard
          title="Top-3 Accuracy"
          value={benchmarkMetrics.top3Accuracy}
          subtitle="Top-3 candidates"
          theme="emerald"
        />
        <StatCard
          title="Macro Precision"
          value={benchmarkMetrics.macroPrecision}
          subtitle="Unweighted avg"
          theme="slate"
        />
        <StatCard
          title="Macro Recall"
          value={benchmarkMetrics.macroRecall}
          subtitle="Class sensitivity"
          theme="slate"
        />
        <StatCard
          title="Macro F1"
          value={benchmarkMetrics.macroF1}
          subtitle="Harmonic mean"
          theme="amber"
        />
        <StatCard
          title="Weighted F1"
          value={benchmarkMetrics.weightedF1}
          subtitle="Sample balanced"
          theme="amber"
        />
      </div>

      {/* Model Architectures & Phase Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Phase 3 CV Classifier */}
        <Card className="p-6 space-y-4 border-cyan-500/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Scan className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Visual Package Classifier</h3>
              </div>
              <p className="text-xs text-cyan-400 font-mono mt-1">MobileNetV3-Small (Transfer Learning)</p>
            </div>
            <Badge variant="success" size="sm" dot>
              Phase 3 Implemented
            </Badge>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Trained on 10 core pharmaceutical packaging classes from the NIH DailyMed Structured Product Labeling (SPL) archive using transfer learning initialized with ImageNet weights.
          </p>

          <div className="rounded-xl bg-slate-950/70 p-3 text-xs space-y-1.5 border border-slate-800">
            <div className="flex justify-between text-slate-400">
              <span>Dataset Split:</span>
              <span className="font-mono text-slate-200">70% Train (70) / 20% Val (20) / 10% Test (10)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Confidence Threshold:</span>
              <span className="font-mono text-cyan-400">0.60 Gate Threshold</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Input Resolution:</span>
              <span className="font-mono text-slate-200">224 x 224 RGB (Normalized)</span>
            </div>
          </div>
        </Card>

        {/* Pending Phase 5 Storage Risk Model */}
        <Card variant="subtle" className="p-6 space-y-4 border-dashed border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-200">Storage-Risk AI/ML Model</h3>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-1">Gradient Boosting / Random Forest</p>
            </div>
            <Badge variant="warning" size="sm" dot>
              Phase 5 Pending
            </Badge>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Planned for Phase 5. Will integrate synthetic environmental risk degradation datasets, temperature excursions, and humidity deltas to generate probabilistic storage stability scores.
          </p>

          <div className="rounded-xl bg-amber-500/5 p-3 text-xs space-y-1.5 border border-amber-500/20 text-amber-300/90">
            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
              <Info className="h-3.5 w-3.5" />
              <span>Phase 5 Status Notice:</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              No storage-risk predictions or synthetic models are fabricated in the current Phase 1–4 release. All storage ranges currently shown in the catalog are verified monograph facts.
            </p>
          </div>
        </Card>
      </div>

      {/* Per-Class Test Evaluation Breakdown */}
      <Card className="p-6 space-y-4">
        <SectionHeader
          icon={<BarChart2 className="h-4 w-4 text-cyan-400" />}
          title="Per-Class Benchmark Breakdown (Isolated Test Split)"
          description="Performance across the 10 trained classes evaluated on 1 isolated test image per class. Evaluates trade dress recognition under challenging real-world orientations."
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-mono uppercase">
              <tr>
                <th className="py-2.5 px-3">Packaging Class</th>
                <th className="py-2.5 px-3">Precision</th>
                <th className="py-2.5 px-3">Recall</th>
                <th className="py-2.5 px-3">F1-Score</th>
                <th className="py-2.5 px-3 text-right">Test Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              {perClassResults.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-sans text-slate-200">{row.className}</td>
                  <td className="py-2.5 px-3">{row.precision}</td>
                  <td className="py-2.5 px-3">{row.recall}</td>
                  <td className="py-2.5 px-3">{row.f1}</td>
                  <td className="py-2.5 px-3 text-right">
                    <Badge
                      variant={
                        row.status === 'Recognized'
                          ? 'success'
                          : row.status === 'Partial'
                          ? 'warning'
                          : 'danger'
                      }
                      size="sm"
                    >
                      {row.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Scope Coverage & Methodological Integrity Notice */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-3">
          <SectionHeader
            icon={<Layers className="h-4 w-4 text-cyan-400" />}
            title="Catalog vs CV Coverage Scope"
          />
          <p className="text-xs text-slate-300 leading-relaxed">
            The MediShelf AI database contains <strong>25 verified pharmaceutical classes</strong> with official FDA DailyMed & USP monographs. The transfer-learning visual classifier is trained on <strong>10 core packaging classes</strong>:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300">
              <span className="font-bold block text-sm">10 Classes</span>
              <span className="text-[11px] text-slate-400">CV Trained & OCR Enabled</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300">
              <span className="font-bold block text-sm">15 Classes</span>
              <span className="text-[11px] text-slate-400">Catalog-Only (Fuzzy OCR fallback)</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <SectionHeader
            icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
            title="Scientific Integrity & Benchmark Interpretation"
          />
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200 leading-relaxed space-y-2">
            <p className="font-semibold text-amber-300">Academic Benchmark Notice:</p>
            <p className="text-[11px] leading-relaxed">
              The isolated test set contains exactly one image per class (10 total samples). These metrics represent an experimental baseline for an academic demonstration rather than evidence of certified clinical production-level recognition performance.
            </p>
            <p className="text-[11px] leading-relaxed">
              Users must always verify the identified medicine name and batch numbers before relying on storage information.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
