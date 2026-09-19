import React from 'react';
import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Thermometer, Droplets } from 'lucide-react';

export const MonitoringPage: React.FC = () => {
  // Simulated hourly ambient tracking points
  const temperatureData = [
    { time: '08:00', temp: 21, safeMin: 15, safeMax: 25 },
    { time: '10:00', temp: 23, safeMin: 15, safeMax: 25 },
    { time: '12:00', temp: 27, safeMin: 15, safeMax: 25 }, // slight deviation
    { time: '14:00', temp: 28, safeMin: 15, safeMax: 25 }, // deviation
    { time: '16:00', temp: 25, safeMin: 15, safeMax: 25 },
    { time: '18:00', temp: 24, safeMin: 15, safeMax: 25 },
    { time: '20:00', temp: 22, safeMin: 15, safeMax: 25 },
  ];

  const humidityData = [
    { time: '08:00', humidity: 45, safeMin: 35, safeMax: 60 },
    { time: '10:00', humidity: 48, safeMin: 35, safeMax: 60 },
    { time: '12:00', humidity: 55, safeMin: 35, safeMax: 60 },
    { time: '14:00', humidity: 58, safeMin: 35, safeMax: 60 },
    { time: '16:00', humidity: 62, safeMin: 35, safeMax: 60 }, // slight elevation
    { time: '18:00', humidity: 54, safeMin: 35, safeMax: 60 },
    { time: '20:00', humidity: 50, safeMin: 35, safeMax: 60 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Environmental Storage Monitoring</h1>
          <p className="text-xs text-slate-400 mt-1">
            Historical storage environment tracking evaluated against configured medicine stability thresholds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
            Current Ambient: <span className="font-semibold text-emerald-400">24°C / 52% RH</span>
          </div>
        </div>
      </div>

      {/* Temperature Trend Chart */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
              <Thermometer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Temperature Trajectory (°C)</h3>
              <p className="text-[11px] text-slate-400">Green dotted lines indicate typical USP room temperature threshold (15°C - 25°C)</p>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20">
            Real-time Telemetry
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLine data={temperatureData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
              <YAxis domain={[10, 35]} stroke="#64748b" fontSize={12} unit="°C" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <ReferenceLine y={25} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Max (25°C)', fill: '#10b981', fontSize: 10 }} />
              <ReferenceLine y={15} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Min (15°C)', fill: '#10b981', fontSize: 10 }} />
              <Line type="monotone" dataKey="temp" stroke="#38bdf8" strokeWidth={2.5} dot={{ fill: '#38bdf8', r: 4 }} activeDot={{ r: 6 }} />
            </RechartsLine>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Humidity Trend Chart */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <Droplets className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Relative Humidity Trajectory (% RH)</h3>
              <p className="text-[11px] text-slate-400">Safe pharmaceutical threshold range (35% - 60% RH)</p>
            </div>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
            Phase 5 Integration
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLine data={humidityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
              <YAxis domain={[20, 80]} stroke="#64748b" fontSize={12} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <ReferenceLine y={60} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Max (60%)', fill: '#10b981', fontSize: 10 }} />
              <ReferenceLine y={35} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Min (35%)', fill: '#10b981', fontSize: 10 }} />
              <Line type="monotone" dataKey="humidity" stroke="#34d399" strokeWidth={2.5} dot={{ fill: '#34d399', r: 4 }} activeDot={{ r: 6 }} />
            </RechartsLine>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
