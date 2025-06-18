
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useDeviceOnlineStatus = () => {
  const [onlineDevices, setOnlineDevices] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkDeviceStatus = async () => {
      try {
        // Check for devices that have sent data in the last 15 seconds (standardized timeout)
        const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000).toISOString();
        
        const { data, error } = await supabase
          .from('energy_data')
          .select('device_id')
          .gte('timestamp', fifteenSecondsAgo)
          .order('timestamp', { ascending: false });

        if (error) {
          console.error('Error checking device status:', error);
          return;
        }

        // Get unique device IDs from recent data
        const recentDevices = new Set(data?.map(d => d.device_id) || []);
        setOnlineDevices(recentDevices);
        
      } catch (error) {
        console.error('Error in device status check:', error);
      }
    };

    // Check immediately
    checkDeviceStatus();

    // Check every 30 seconds
    const interval = setInterval(checkDeviceStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const isDeviceOnline = (deviceId: string): boolean => {
    return onlineDevices.has(deviceId);
  };

  const isDeviceChannelOnline = (deviceId: string, channelNumber: number): boolean => {
    // For now, if the device is online, consider all its channels online
    // This can be enhanced later to check per-channel status
    return isDeviceOnline(deviceId);
  };

  const getOnlineDevicesCount = (deviceIds: string[]): number => {
    return deviceIds.filter(deviceId => isDeviceOnline(deviceId)).length;
  };

  return { 
    isDeviceOnline, 
    onlineDevices,
    isDeviceChannelOnline,
    getOnlineDevicesCount
  };
};
