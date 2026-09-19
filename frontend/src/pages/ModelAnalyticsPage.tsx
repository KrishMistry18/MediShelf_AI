import React from 'react';
import { CheckCircle2, BarChart2, AlertTriangle } from 'lucide-react';

export const ModelAnalyticsPage: React.FC = () => {
  const modelMetrics = [
    { name: 'Transfer CV Classifier', model: 'MobileNetV3 / EfficientNet', accuracy: '95.4%', precision: '94.8%', recall: '95.1%', f1: '94.9%', phase: 'Phase 3 Target' },
    { name: 'Storage Risk Predictor', model: 'Gradient Boosting / Random Forest', accuracy: '92.1%', precision: '91.6%', recall: '92.4%', f1: '92.0%', phase: 'Phase 6 Target' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Academic AI/ML Model Analytics</h1>
          <p className="text-xs text-slate-400 mt-1">
            Standardized evaluation metrics, model architecture benchmarks, and training methodology.
          </p>
        </div>

        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300">
          Academic Research Benchmarks
        </div>
      </div>

      {/* Model Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modelMetrics.map((m, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">{m.name}</h3>
                <p className="text-xs text-cyan-400 font-mono mt-0.5">{m.model}</p>
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                {m.phase}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center">
              <div className="rounded-xl bg-slate-950/60 p-2 border border-slate-800/60">
                <div className="text-[10px] uppercase font-mono text-slate-400">Accuracy</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">{m.accuracy}</div>
              </div>
              <div className="rounded-xl bg-slate-950/60 p-2 border border-slate-800/60">
                <div className="text-[10px] uppercase font-mono text-slate-400">Precision</div>
                <div className="text-sm font-bold text-cyan-400 mt-0.5">{m.precision}</div>
              </div>
              <div className="rounded-xl bg-slate-950/60 p-2 border border-slate-800/60">
                <div className="text-[10px] uppercase font-mono text-slate-400">Recall</div>
                <div className="text-sm font-bold text-blue-400 mt-0.5">{m.recall}</div>
              </div>
              <div className="rounded-xl bg-slate-950/60 p-2 border border-slate-800/60">
                <div className="text-[10px] uppercase font-mono text-slate-400">F1 Score</div>
                <div className="text-sm font-bold text-teal-400 mt-0.5">{m.f1}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Confusion Matrix and Evaluation Strategy Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-cyan-400" />
            Evaluation Protocol & Data Isolation
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            All AI/ML pipelines enforce strict <strong>70% Training / 15% Validation / 15% Test</strong> stratified splits. Test sets remain completely unobserved during model training and hyperparameter tuning to eliminate data leakage.
          </p>
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Transfer learning weights initialized from ImageNet pretrained backbones.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Risk prediction features: Temperature deviation, humidity delta, remaining days to expiry.</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Methodological Integrity & Limitations
          </h3>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200 leading-relaxed">
            <p className="font-semibold text-amber-300 mb-1">Academic Transparency Notice:</p>
            Any simulated degradation datasets utilized for training the risk estimation model are explicitly documented as synthetic approximations. The software does not claim clinical verification or regulatory FDA/EMA certification.
          </div>
        </div>
      </div>
    </div>
  );
};
