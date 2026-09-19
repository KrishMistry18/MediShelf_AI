import React from 'react';
import {
  BarChart2,
  AlertTriangle,
  Scan,
  Info,
  Layers,
  Brain,
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

        {/* Active Phase 5 Storage Risk Model */}
        <Card className="p-6 space-y-4 border-indigo-500/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Storage-Risk AI/ML Model</h3>
              </div>
              <p className="text-xs text-indigo-400 font-mono mt-1">GradientBoostingClassifier (Scikit-Learn)</p>
            </div>
            <Badge variant="success" size="sm" dot>
              Phase 5 Implemented
            </Badge>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Trained on 6,000 simulation-derived packaging stability excursion scenarios grounded strictly in official USP/FDA monograph constraints across 15 physicochemical and kinetic features.
          </p>

          <div className="rounded-xl bg-slate-950/70 p-3 text-xs space-y-1.5 border border-slate-800">
            <div className="flex justify-between text-slate-400">
              <span>Dataset Split:</span>
              <span className="font-mono text-slate-200">70% Train (4,200) / 15% Val (900) / 15% Test (900)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Macro F1 (Test Set):</span>
              <span className="font-mono text-emerald-400">0.9958 (99.56% Accuracy)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Target Classes:</span>
              <span className="font-mono text-slate-200">LOW (44.5%), MODERATE (28.8%), HIGH (26.7%)</span>
            </div>
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

      {/* Phase 5: Storage Risk ML Model Benchmark & Evaluation */}
      <Card className="p-6 space-y-5 border-cyan-500/30 bg-slate-900/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
          <SectionHeader
            icon={<Brain className="h-5 w-5 text-cyan-400" />}
            title="Phase 5: Storage Risk ML Model Benchmark & Evaluation"
            description="Trained degradation risk classifier evaluated on 6,000 simulation-derived scenarios grounded in USP/FDA monographs."
          />
          <Badge variant="success" size="sm" className="font-mono self-start sm:self-auto">
            GradientBoostingClassifier v1.0
          </Badge>
        </div>

        {/* Phase 5 Test Set Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Test Accuracy</span>
            <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">99.56%</span>
            <span className="text-[10px] text-slate-500">900 isolated test samples</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Test Macro F1</span>
            <span className="text-xl font-bold font-mono text-cyan-400 mt-1 block">0.9958</span>
            <span className="text-[10px] text-slate-500">Unweighted class average</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Test Weighted F1</span>
            <span className="text-xl font-bold font-mono text-cyan-400 mt-1 block">0.9956</span>
            <span className="text-[10px] text-slate-500">Support-weighted score</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Training Scenarios</span>
            <span className="text-xl font-bold font-mono text-indigo-400 mt-1 block">6,000</span>
            <span className="text-[10px] text-slate-500">70% train / 15% val / 15% test</span>
          </div>
        </div>

        {/* Model Comparison Table & Feature Importances */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Candidate Models Comparison */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Candidate Models Validation Comparison
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Model Candidate</th>
                    <th className="py-2.5 px-3">Val Accuracy</th>
                    <th className="py-2.5 px-3">Val Macro F1</th>
                    <th className="py-2.5 px-3 text-right">Selection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-medium text-slate-200">Logistic Regression (StandardScaler)</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">91.90%</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">0.9171</td>
                    <td className="py-2.5 px-3 text-right text-slate-500">Baseline</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-medium text-slate-200">Random Forest Classifier (100 trees)</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400">99.67%</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400">0.9966</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">Strong</td>
                  </tr>
                  <tr className="bg-cyan-950/20 hover:bg-cyan-950/30 border-l-2 border-l-cyan-400">
                    <td className="py-2.5 px-3 font-bold text-white">Gradient Boosting Classifier</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-cyan-300">99.78%</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-cyan-300">0.9979</td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge variant="success" size="sm">Selected</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Feature Importances */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Trained Model Feature Importances
            </h4>
            <div className="space-y-2 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Cumulative Thermal Severity (Excursion × Hours)</span>
                  <span className="font-mono text-cyan-400 font-bold">85.2%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: '85.2%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Days to Expiry (Remaining Shelf Life)</span>
                  <span className="font-mono text-indigo-400 font-bold">5.8%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-indigo-400 rounded-full" style={{ width: '5.8%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Observed Ambient Temperature</span>
                  <span className="font-mono text-teal-400 font-bold">4.6%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-teal-400 rounded-full" style={{ width: '4.6%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Near-Expiry Threshold State</span>
                  <span className="font-mono text-amber-400 font-bold">1.2%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: '1.2%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Heat Excursion Above Upper Limit</span>
                  <span className="font-mono text-rose-400 font-bold">1.1%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-rose-400 rounded-full" style={{ width: '1.1%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Confusion Matrix (Test Set) */}
        <div className="pt-2">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
            Isolated Test Set Confusion Matrix (900 Scenarios)
          </h4>
          <div className="grid grid-cols-4 max-w-md text-center text-xs border border-slate-800 rounded-xl overflow-hidden font-mono">
            <div className="bg-slate-950 p-2 text-slate-500 font-sans text-[11px]">True \ Pred</div>
            <div className="bg-slate-950 p-2 text-slate-300 font-bold">Pred LOW</div>
            <div className="bg-slate-950 p-2 text-slate-300 font-bold">Pred MOD</div>
            <div className="bg-slate-950 p-2 text-slate-300 font-bold">Pred HIGH</div>

            <div className="bg-slate-900/90 p-2 text-slate-300 font-bold font-sans text-left pl-3">True LOW</div>
            <div className="bg-emerald-950/40 p-2 text-emerald-400 font-bold">396</div>
            <div className="bg-slate-900/60 p-2 text-slate-400">1</div>
            <div className="bg-slate-900/60 p-2 text-slate-500">0</div>

            <div className="bg-slate-900/90 p-2 text-slate-300 font-bold font-sans text-left pl-3">True MOD</div>
            <div className="bg-slate-900/60 p-2 text-slate-400">3</div>
            <div className="bg-amber-950/40 p-2 text-amber-400 font-bold">258</div>
            <div className="bg-slate-900/60 p-2 text-slate-500">0</div>

            <div className="bg-slate-900/90 p-2 text-slate-300 font-bold font-sans text-left pl-3">True HIGH</div>
            <div className="bg-slate-900/60 p-2 text-slate-500">0</div>
            <div className="bg-slate-900/60 p-2 text-slate-500">0</div>
          </div>
        </div>

        {/* Scientific & Academic Disclaimer Notice */}
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-xs text-slate-300 leading-relaxed space-y-1.5">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold">
            <Info className="h-4 w-4" />
            <span>Simulation-Derived Benchmark Notice:</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            The 99.56% test accuracy and 0.9958 Macro F1 score are evaluated strictly on the 900-sample held-out simulated storage-risk benchmark. Because proprietary real-world pharmaceutical stability excursion test data is protected under commercial trade secrets, the model is trained on simulation-derived scenarios grounded in official USP/FDA monographs. Predictions provide AI-assisted decision support and do not guarantee chemical stability or clinical safety.
          </p>
        </div>
      </Card>
    </div>
  );
};
