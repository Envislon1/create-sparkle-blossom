import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEnergy } from '@/contexts/EnergyContext';
import { useDeviceOnlineStatus } from '@/hooks/useDeviceOnlineStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TotalBillingManager from './TotalBillingManager';
import DeviceManager from './DeviceManager';
import OTAManager from './OTAManager';
import TenantsOverview from './TenantsOverview';
import EnhancedDeviceOverview from './EnhancedDeviceOverview';
import SystemSettings from './SystemSettings';
import SurgeCapacityManager from './SurgeCapacityManager';
import { ThemeToggle } from './ThemeToggle';
import { LogOut, Zap, Activity, Home } from 'lucide-react';

const Dashboard = () => {
  const {
    user,
    profile,
    logout
  } = useAuth();
  const {
    deviceAssignments,
    energyReadings,
    selectedDeviceId,
    isLoading,
    deviceChannels,
    refreshData
  } = useEnergy();
  const {
    getOnlineDevicesCount,
    isDeviceOnline
  } = useDeviceOnlineStatus();

  // Filter data for selected device
  const selectedDevice = deviceAssignments.find(d => d.device_id === selectedDeviceId);
  const selectedDeviceReadings = energyReadings.filter(reading => reading.device_id === selectedDeviceId);

  // Calculate metrics based on ONLY registered devices
  const totalDevices = deviceAssignments.length;

  // Get device IDs that are registered in the dashboard
  const registeredDeviceIds = deviceAssignments.map(d => d.device_id);

  // Filter energy readings to only include registered devices
  const registeredDeviceReadings = energyReadings.filter(reading => registeredDeviceIds.includes(reading.device_id));

  // Calculate active devices using standardized 15-second timeout
  const getActiveDevicesCount = () => {
    let activeDevices = 0;
    
    deviceAssignments.forEach(device => {
      const deviceChannelsForDevice = deviceChannels.filter(ch => ch.device_id === device.device_id);
      const deviceReadings = registeredDeviceReadings.filter(r => r.device_id === device.device_id);
      
      let hasActiveChannel = false;
      deviceChannelsForDevice.forEach(channel => {
        const channelReadings = deviceReadings
          .filter(r => r.channel_number === channel.channel_number)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        if (channelReadings.length > 0) {
          const latest = channelReadings[0];
          const isRecent = (Date.now() - new Date(latest.timestamp).getTime()) < 15000; // Standardized to 15 seconds
          if (isRecent) {
            hasActiveChannel = true;
          }
        }
      });
      
      if (hasActiveChannel) {
        activeDevices++;
      }
    });
    
    return activeDevices;
  };

  const activeDevicesCount = getActiveDevicesCount();

  // Calculate total consumption in kWh from registered devices - ALWAYS use latest energy values regardless of online status
  const calculateTotalConsumption = () => {
    let totalConsumptionWh = 0;
    
    // For each device and channel combination, get only the latest energy reading
    deviceAssignments.forEach(device => {
      const deviceChannelsForDevice = deviceChannels.filter(ch => ch.device_id === device.device_id);
      const deviceReadings = registeredDeviceReadings.filter(r => r.device_id === device.device_id);
      
      deviceChannelsForDevice.forEach(channel => {
        const channelReadings = deviceReadings
          .filter(r => r.channel_number === channel.channel_number)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        if (channelReadings.length > 0) {
          const latestReading = channelReadings[0];
          // ALWAYS use the latest energy value, regardless of device online status
          totalConsumptionWh += (latestReading.energy_wh || 0);
        }
      });
    });
    
    return totalConsumptionWh;
  };

  const totalConsumptionWh = calculateTotalConsumption();
  const totalConsumptionKwh = totalConsumptionWh / 1000;

  // Calculate total current from selected device - ALWAYS retain last known values
  const totalCurrent = selectedDevice ? (() => {
    const deviceReadings = selectedDeviceReadings;
    if (deviceReadings.length === 0) return 0;

    // Get all expected channels for this device
    const expectedChannels = Array.from({
      length: selectedDevice.channel_count
    }, (_, i) => i + 1);
    const deviceCurrentSum = expectedChannels.reduce((deviceSum, channelNumber) => {
      const channelReadings = deviceReadings.filter(r => r.channel_number === channelNumber).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (channelReadings.length === 0) return deviceSum; // Channel has no readings yet

      const latestReading = channelReadings[0];
      // ALWAYS use latest current value, regardless of online status
      return deviceSum + (latestReading.current || 0);
    }, 0);
    return deviceCurrentSum;
  })() : 0;

  // Calculate tenant metrics using standardized timeout
  const calculateTenantMetrics = () => {
    let totalTenants = 0;
    let activeTenants = 0;
    deviceAssignments.forEach(device => {
      const deviceChannelsForDevice = deviceChannels.filter(ch => ch.device_id === device.device_id);
      const deviceReadings = registeredDeviceReadings.filter(r => r.device_id === device.device_id);

      // Each channel represents one tenant
      deviceChannelsForDevice.forEach(channel => {
        totalTenants++;
        const channelReadings = deviceReadings.filter(r => r.channel_number === channel.channel_number).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (channelReadings.length > 0) {
          const latest = channelReadings[0];
          const isRecent = Date.now() - new Date(latest.timestamp).getTime() < 15000; // Standardized to 15 seconds
          if (isRecent) {
            activeTenants++;
          }
        }
      });
    });
    return {
      totalTenants,
      activeTenants
    };
  };
  const {
    totalTenants,
    activeTenants
  } = calculateTenantMetrics();

  // Extract first name from full name for welcome message
  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

  // Helper function to get responsive font size based on number length
  const getResponsiveFontSize = (value: number) => {
    const valueStr = value.toFixed(1);
    if (valueStr.length <= 5) return 'text-2xl';
    if (valueStr.length <= 7) return 'text-xl';
    if (valueStr.length <= 9) return 'text-lg';
    return 'text-base';
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-400 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading EnergyTracker...</p>
        </div>
      </div>;
  }
  
  return <div className="min-h-screen bg-gradient-to-br from-gray-200 to-gray-400 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-10">
        <div className="container mx-auto sm:px-4 py-3 sm:py-4 px-[13px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-white dark:bg-black rounded-lg">
                <Home className="w-4 h-4 sm:w-6 sm:h-6 text-black dark:text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-foreground">EnergyTracker</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Monitor and manage electrical consumption across all tenants
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="text-right hidden md:block">
                <p className="font-medium text-foreground text-sm">Welcome, {firstName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <ThemeToggle />
              <Button variant="outline" onClick={logout} className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4" size="sm">
                <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto sm:px-4 py-4 sm:py-8 px-[13px] bg-white dark:bg-transparent">
        {/* Enhanced Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Consumption</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`${getResponsiveFontSize(totalConsumptionKwh)} font-bold`}>
                {totalConsumptionKwh.toFixed(1)} kWh
              </div>
              <p className="text-xs text-muted-foreground">Latest readings from all channels</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activeDevicesCount}/{totalDevices}
              </div>
              <p className="text-xs text-muted-foreground">Devices with active monitoring</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tenants</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeTenants}/{totalTenants}</div>
              <p className="text-xs text-muted-foreground">Active monitoring</p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Main Content Tabs - Removed Real-time tab */}
        <Tabs defaultValue="tenants" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="tenants" className="space-y-4">
            <TenantsOverview />
          </TabsContent>

          <TabsContent value="devices" className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium">Monitoring Devices</h3>
            </div>
            <EnhancedDeviceOverview />
          </TabsContent>

          <TabsContent value="manage" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
              {/* Left Column - Total Billing and Surge Capacity */}
              <div className="space-y-4 sm:space-y-8">
                <TotalBillingManager />
                <SurgeCapacityManager />
              </div>

              {/* Right Column - Device Management */}
              <div className="space-y-4 sm:space-y-8">
                <DeviceManager />
                <OTAManager />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <SystemSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>;
};
export default Dashboard;
