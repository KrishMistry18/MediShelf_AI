import React, { useEffect, useState, useCallback } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardOverview } from './pages/DashboardOverview';
import { MonitoringPage } from './pages/MonitoringPage';
import { MedicinesPage } from './pages/MedicinesPage';
import { ScanPage } from './pages/ScanPage';
import { AlertsPage } from './pages/AlertsPage';
import { ModelAnalyticsPage } from './pages/ModelAnalyticsPage';
import type { SystemHealth, TabKey } from './types';
import { fetchSystemHealth } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSystemHealth();
      setHealth(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initialFetch = async () => {
      setLoading(true);
      try {
        const data = await fetchSystemHealth();
        if (isMounted) setHealth(data);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initialFetch();
    const timer = setInterval(() => {
      loadHealth();
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [loadHealth]);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <DashboardOverview
            health={health}
            onNavigateToScan={() => setActiveTab('scan')}
          />
        );
      case 'medicines':
        return <MedicinesPage />;
      case 'scan':
        return <ScanPage onNavigateToMedicines={() => setActiveTab('medicines')} />;
      case 'monitoring':
        return <MonitoringPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'models':
        return <ModelAnalyticsPage />;
      default:
        return (
          <DashboardOverview
            health={health}
            onNavigateToScan={() => setActiveTab('scan')}
          />
        );
    }
  };

  return (
    <AppLayout
      health={health}
      loading={loading}
      onRefreshHealth={loadHealth}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
    >
      {renderActivePage()}
    </AppLayout>
  );
};

export default App;
