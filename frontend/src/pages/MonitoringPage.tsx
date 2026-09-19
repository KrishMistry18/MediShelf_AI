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
import { Thermometer, Droplets, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Card,
  PageHeader,
  SectionHeader,
  StatCard,
} from '../components/common';

export const MonitoringPage: React.FC = () => {
  // Ambient tracking telemetry points
  const temperatureData = [
    { time: '08:00', temp: 21, safeMin: 15, safeMax: 25 },
    { time: '10:00', temp: 23, safeMin: 15, safeMax: 25 },
    { time: '12:00', temp: 26, safeMin: 15, safeMax: 25 },
    { time: '14:00', temp: 27, safeMin: 15, safeMax: 25 },
    { time: '16:00', temp: 25, safeMin: 15, safeMax: 25 },
    { time: '18:00', temp: 24, safeMin: 15, safeMax: 25 },
    { time: '20:00', temp: 22, safeMin: 15, safeMax: 25 },
  ];

  const humidityData = [
    { time: '08:00', humidity: 45, safeMin: 35, safeMax: 60 },
    { time: '10:00', humidity: 48, safeMin: 35, safeMax: 60 },
    { time: '12:00', humidity: 55, safeMin: 35, safeMax: 60 },
    { time: '14:00', humidity: 58, safeMin: 35, safeMax: 60 },
    { time: '16:00', humidity: 62, safeMin: 35, safeMax: 60 },
    { time: '18:00', humidity: 54, safeMin: 35, safeMax: 60 },
    { time: '20:00', humidity: 50, safeMin: 35, safeMax: 60 },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge={
          <Badge variant="info" size="sm" dot>
            Environmental Storage Telemetry
          </Badge>
        }
        title="Environmental Storage Conditions Monitoring"
        description="Historical storage atmosphere tracking evaluated against verified pharmaceutical stability boundaries. Current evaluation uses deterministic threshold rules; machine-learning degradation risk estimation is scheduled for Phase 5."
        actions={
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2 text-xs text-slate-300">
            Current Ambient:{' '}
            <span className="font-semibold text-emerald-400 font-mono">22°C / 50% RH</span>
          </div>
        }
      />

      {/* Ambient Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Ambient Temperature"
          value="22.0°C"
          subtitle="Nominal Room Temperature (15-25°C)"
          icon={<Thermometer className="h-5 w-5" />}
          theme="cyan"
        />
        <StatCard
          title="Relative Humidity"
          value="50% RH"
          subtitle="Nominal Humidity Window (35-60% RH)"
          icon={<Droplets className="h-5 w-5" />}
          theme="emerald"
        />
        <StatCard
          title="Storage Compliance"
          value="Nominal"
          subtitle="Deterministic range compliance active"
          icon={<ShieldCheck className="h-5 w-5" />}
          theme="emerald"
        />
      </div>

      {/* Temperature Trend Chart */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <SectionHeader
            icon={<Thermometer className="h-5 w-5 text-cyan-400" />}
            title="Temperature Trajectory (°C)"
            description="Green dashed boundaries indicate standard USP Controlled Room Temperature (15°C – 25°C)"
          />
          <Badge variant="info" size="sm">
            Telemetry Stream
          </Badge>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLine data={temperatureData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
              <YAxis domain={[10, 35]} stroke="#64748b" fontSize={12} unit="°C" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <ReferenceLine
                y={25}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{ value: 'USP Max (25°C)', fill: '#10b981', fontSize: 10, position: 'top' }}
              />
              <ReferenceLine
                y={15}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{ value: 'USP Min (15°C)', fill: '#10b981', fontSize: 10, position: 'bottom' }}
              />
              <Line
                type="monotone"
                dataKey="temp"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={{ fill: '#38bdf8', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </RechartsLine>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Humidity Trend Chart */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <SectionHeader
            icon={<Droplets className="h-5 w-5 text-emerald-400" />}
            title="Relative Humidity Trajectory (% RH)"
            description="Green dashed boundaries indicate standard pharmaceutical packaging humidity safe window (35% – 60% RH)"
          />
          <Badge variant="success" size="sm">
            Hygrometry Stream
          </Badge>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLine data={humidityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
              <YAxis domain={[20, 80]} stroke="#64748b" fontSize={12} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <ReferenceLine
                y={60}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{ value: 'Safe Max (60% RH)', fill: '#10b981', fontSize: 10, position: 'top' }}
              />
              <ReferenceLine
                y={35}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{ value: 'Safe Min (35% RH)', fill: '#10b981', fontSize: 10, position: 'bottom' }}
              />
              <Line
                type="monotone"
                dataKey="humidity"
                stroke="#34d399"
                strokeWidth={2.5}
                dot={{ fill: '#34d399', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </RechartsLine>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
