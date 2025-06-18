
import React, { useMemo } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { EnergyProvider } from '@/contexts/EnergyContext';
import Login from '@/components/Login';
import Dashboard from '@/components/Dashboard';
import DeepLinkHandler from '@/components/DeepLinkHandler';
import GlobalOTAProgressMonitor from '@/components/GlobalOTAProgressMonitor';

// Content component that uses the auth context
// This component must be inside the AuthProvider
const AppContent = () => {
  const { user, isLoading } = useAuth();

  // Memoize the loading screen to prevent unnecessary re-renders
  const loadingScreen = useMemo(() => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-orange-400">Loading EnergyTracker...</p>
      </div>
    </div>
  ), []);

  // Memoize the login component
  const loginComponent = useMemo(() => <Login />, []);

  if (isLoading) {
    return loadingScreen;
  }

  if (!user) {
    return loginComponent;
  }

  return (
    <EnergyProvider>
      <Dashboard />
      <GlobalOTAProgressMonitor />
    </EnergyProvider>
  );
};

// Main Index component that provides the AuthProvider and ThemeProvider
const Index = () => {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="dark" storageKey="energy-monitor-theme">
        <DeepLinkHandler />
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
};

export default Index;
