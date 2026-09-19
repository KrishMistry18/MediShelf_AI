import React from 'react';
import { Clock, Thermometer, Droplets } from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const alerts = [
    {
      id: 'ALT-101',
      type: 'TEMP_DEVIATION',
      severity: 'WARNING',
      title: 'Human Insulin Regular: Temperature Spike Detected',
      message: 'Current refrigerator temperature is 9.5°C, exceeding configured maximum threshold of 8.0°C.',
      time: '12 minutes ago',
      source: 'Deterministic Threshold Rule',
      icon: Thermometer,
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    {
      id: 'ALT-102',
      type: 'EXPIRY_WARNING',
      severity: 'CRITICAL',
      title: 'Aspirin Gastro-resistant: Medicine Expired',
      message: 'Configured expiry date was 2025-12-31. Medicine is beyond manufacturer shelf-life window.',
      time: '1 hour ago',
      source: 'OCR + Deterministic Expiry Rule',
      icon: Clock,
      badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    },
    {
      id: 'ALT-103',
      type: 'HUMIDITY_ELEVATION',
      severity: 'WARNING',
      title: 'Storage Room B: Relative Humidity Alert',
      message: 'Storage shelf humidity reached 62% RH (configured threshold: 60% max).',
      time: '3 hours ago',
      source: 'Environmental Telemetry',
      icon: Droplets,
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Active Storage & Expiry Alerts</h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated alerts categorizing deterministic boundary breaches and ML predicted risk factors.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
          Total Unresolved: <span className="font-semibold text-amber-400">3 Alerts</span>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon = alert.icon;
          return (
            <div
              key={alert.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition hover:border-slate-700"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`rounded-lg p-2 ${alert.badgeColor} border`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">{alert.title}</h4>
                </div>
                <span className="text-[11px] font-mono text-slate-400">{alert.time}</span>
              </div>

              <p className="text-xs text-slate-300 ml-10 mt-1">{alert.message}</p>

              <div className="flex items-center gap-3 ml-10 mt-3 pt-3 border-t border-slate-800/60 text-[11px] text-slate-400">
                <span>Detection Source: <strong className="text-slate-300">{alert.source}</strong></span>
                <span>•</span>
                <span className="font-mono text-cyan-400">{alert.id}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
