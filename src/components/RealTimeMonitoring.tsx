
import React from 'react';
import { useEnergy } from '@/contexts/EnergyContext';
import PowerUsageCard from './PowerUsageCard';

const RealTimeMonitoring = () => {
  const { deviceAssignments, energyReadings, deviceChannels } = useEnergy();

  // Generate tenant data for real-time monitoring
  const generateTenantData = () => {
    const tenants = [];
    let tenantIndex = 1; // Simple counter for tenant numbering
    
    deviceAssignments.forEach((device) => {
      const deviceChannelsForDevice = deviceChannels.filter(ch => ch.device_id === device.device_id);
      const deviceReadings = energyReadings.filter(r => r.device_id === device.device_id);
      
      // Create individual tenants for each channel
      deviceChannelsForDevice.forEach((channel) => {
        const channelReadings = deviceReadings
          .filter(r => r.channel_number === channel.channel_number)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        let totalCurrent = 0;
        let isOnline = false;
        
        if (channelReadings.length > 0) {
          const latest = channelReadings[0];
          const isRecent = (Date.now() - new Date(latest.timestamp).getTime()) < 15000;
          if (isRecent) {
            totalCurrent = latest.current || 0;
            isOnline = true;
          }
        }
        
        tenants.push({
          id: `tenant-${tenantIndex}`,
          name: `Tenant ${tenantIndex}`,
          deviceId: device.device_id,
          channels: [channel.channel_number],
          currentAmps: [totalCurrent],
          isOnline
        });
        
        tenantIndex++;
      });
    });
    
    return tenants;
  };

  const tenants = generateTenantData();

  if (tenants.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No tenant data available. Add devices and channels to see real-time monitoring.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {tenants.map((tenant) => (
        <PowerUsageCard
          key={tenant.id}
          name={tenant.name}
          deviceId={tenant.deviceId}
          channels={tenant.channels}
          currentAmps={tenant.currentAmps}
        />
      ))}
    </div>
  );
};

export default RealTimeMonitoring;
