import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface DeviceAssignment {
  id: string;
  device_id: string;
  device_name: string;
  custom_name?: string;
  user_id: string;
  channel_count: number;
  created_at: string;
}

interface DeviceChannel {
  id: string;
  device_id: string;
  channel_number: number;
  custom_name?: string;
  user_id: string;
  created_at: string;
}

interface EnergyReading {
  id: string;
  device_id: string;
  channel_number: number;
  current?: number;
  power?: number;
  energy_wh?: number;
  cost?: number;
  timestamp: string;
  created_at: string;
}

interface TotalBillSetting {
  id: string;
  device_id: string;
  total_bill_amount: number;
  billing_period?: string;
  created_at: string;
  updated_at: string;
}

interface SurgeCapacitySetting {
  id: string;
  device_id: string;
  channel_number: number;
  max_amperage: number;
  created_at: string;
  updated_at: string;
}

interface EnergyContextType {
  deviceAssignments: DeviceAssignment[];
  deviceChannels: DeviceChannel[];
  energyReadings: EnergyReading[];
  totalBillSettings: TotalBillSetting[];
  surgeCapacitySettings: SurgeCapacitySetting[];
  selectedDeviceId: string | null;
  setSelectedDeviceId: (deviceId: string | null) => void;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  assignDevice: (deviceId: string, deviceName: string, channelCount: number) => Promise<{ error?: string }>;
  updateChannelName: (deviceId: string, channelNumber: number, customName: string) => Promise<{ error?: string }>;
  removeDevice: (deviceId: string) => Promise<{ error?: string }>;
  updateTotalBill: (deviceId: string, amount: number) => Promise<{ error?: string }>;
  updateSurgeCapacity: (deviceId: string, channelNumber: number, maxAmperage: number) => Promise<{ error?: string }>;
  voteForEnergyReset: (deviceId: string) => Promise<any>;
  getEnergyResetStatus: (deviceId: string) => Promise<any>;
}

const EnergyContext = createContext<EnergyContextType | undefined>(undefined);

export const useEnergy = () => {
  const context = useContext(EnergyContext);
  if (!context) {
    throw new Error('useEnergy must be used within an EnergyProvider');
  }
  return context;
};

export const EnergyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  const [deviceAssignments, setDeviceAssignments] = useState<DeviceAssignment[]>([]);
  const [deviceChannels, setDeviceChannels] = useState<DeviceChannel[]>([]);
  const [energyReadings, setEnergyReadings] = useState<EnergyReading[]>([]);
  const [totalBillSettings, setTotalBillSettings] = useState<TotalBillSetting[]>([]);
  const [surgeCapacitySettings, setSurgeCapacitySettings] = useState<SurgeCapacitySetting[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use refs to track subscriptions and prevent multiple setups
  const subscriptionsRef = useRef<any[]>([]);
  const userDeviceIdsRef = useRef<string[]>([]);
  const isSubscribedRef = useRef(false);
  const initialDataFetchedRef = useRef(false);

  // Stable fetch functions
  const fetchDeviceAssignments = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('device_assignments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching device assignments:', error);
      return;
    }

    console.log('Fetched device assignments from database:', data?.length || 0, 'records');
    setDeviceAssignments(data || []);
    
    // Set first device as selected if none selected
    if (data && data.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(data[0].device_id);
    }

    // Update device IDs ref for real-time filtering
    userDeviceIdsRef.current = data?.map(d => d.device_id) || [];
  }, [user?.id, selectedDeviceId]);

  const fetchDeviceChannels = useCallback(async () => {
    if (!user || userDeviceIdsRef.current.length === 0) return;

    // Fetch channels for all user's devices - channels are shared but we generate them based on channel_count
    const deviceChannelsData: DeviceChannel[] = [];
    
    for (const assignment of deviceAssignments) {
      for (let i = 1; i <= assignment.channel_count; i++) {
        deviceChannelsData.push({
          id: `${assignment.device_id}-${i}`,
          device_id: assignment.device_id,
          channel_number: i,
          custom_name: `Channel ${i}`,
          user_id: user.id,
          created_at: assignment.created_at
        });
      }
    }

    console.log('Generated device channels:', deviceChannelsData.length, 'records');
    setDeviceChannels(deviceChannelsData);
  }, [user?.id, deviceAssignments]);

  const fetchEnergyReadings = useCallback(async () => {
    if (!user || userDeviceIdsRef.current.length === 0) return;

    console.log('Fetching energy readings for devices:', userDeviceIdsRef.current);

    const { data, error } = await supabase
      .from('energy_data')
      .select('*')
      .in('device_id', userDeviceIdsRef.current)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching energy readings:', error);
      return;
    }

    console.log('Fetched energy readings from database:', data?.length || 0, 'records');
    setEnergyReadings(data || []);
  }, [user?.id]);

  const fetchTotalBillSettings = useCallback(async () => {
    if (!user || userDeviceIdsRef.current.length === 0) return;

    const { data, error } = await supabase
      .from('total_bill_settings')
      .select('*')
      .in('device_id', userDeviceIdsRef.current);

    if (error) {
      console.error('Error fetching total bill settings:', error);
      return;
    }

    console.log('Fetched total bill settings from database:', data?.length || 0, 'records');
    setTotalBillSettings(data || []);
  }, [user?.id]);

  const fetchSurgeCapacitySettings = useCallback(async () => {
    if (!user || userDeviceIdsRef.current.length === 0) return;

    const { data, error } = await supabase
      .from('surge_capacity_settings')
      .select('*')
      .in('device_id', userDeviceIdsRef.current);

    if (error) {
      console.error('Error fetching surge capacity settings:', error);
      return;
    }

    console.log('Fetched surge capacity settings from database:', data?.length || 0, 'records');
    setSurgeCapacitySettings(data || []);
  }, [user?.id]);

  // CRUD operations
  const assignDevice = async (deviceId: string, deviceName: string, channelCount: number) => {
    if (!user) return { error: 'User not authenticated' };

    try {
      // Insert device assignment
      const { error: assignError } = await supabase
        .from('device_assignments')
        .insert({
          device_id: deviceId,
          device_name: deviceName,
          user_id: user.id,
          channel_count: channelCount
        });

      if (assignError) {
        console.error('Error assigning device:', assignError);
        return { error: assignError.message };
      }

      await refreshData();
      return {};
    } catch (error) {
      console.error('Error in assignDevice:', error);
      return { error: 'Failed to assign device' };
    }
  };

  const updateChannelName = async (deviceId: string, channelNumber: number, customName: string) => {
    if (!user) return { error: 'User not authenticated' };

    try {
      // For now, just update the local state since channels are generated dynamically
      setDeviceChannels(prev => 
        prev.map(channel => 
          channel.device_id === deviceId && channel.channel_number === channelNumber
            ? { ...channel, custom_name: customName }
            : channel
        )
      );
      return {};
    } catch (error) {
      console.error('Error in updateChannelName:', error);
      return { error: 'Failed to update channel name' };
    }
  };

  const removeDevice = async (deviceId: string) => {
    if (!user) return { error: 'User not authenticated' };

    try {
      console.log(`Removing device assignment for user ${user.id} and device ${deviceId}`);
      
      // Remove only the user's device assignment
      const { error: assignmentError } = await supabase
        .from('device_assignments')
        .delete()
        .eq('device_id', deviceId)
        .eq('user_id', user.id);

      if (assignmentError) {
        console.error('Error removing device assignment:', assignmentError);
        return { error: assignmentError.message };
      }

      console.log(`Successfully removed device assignment for user ${user.id} and device ${deviceId}`);

      await refreshData();
      return {};
    } catch (error) {
      console.error('Error in removeDevice:', error);
      return { error: 'Failed to remove device assignment' };
    }
  };

  const updateTotalBill = async (deviceId: string, amount: number) => {
    if (!user) return { error: 'User not authenticated' };

    try {
      const { error } = await supabase
        .from('total_bill_settings')
        .upsert({
          device_id: deviceId,
          total_bill_amount: amount,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'device_id'
        });

      if (error) {
        console.error('Error updating total bill:', error);
        return { error: error.message };
      }

      await fetchTotalBillSettings();
      return {};
    } catch (error) {
      console.error('Error in updateTotalBill:', error);
      return { error: 'Failed to update total bill' };
    }
  };

  const updateSurgeCapacity = async (deviceId: string, channelNumber: number, maxAmperage: number) => {
    if (!user) return { error: 'User not authenticated' };

    try {
      const { error } = await supabase
        .from('surge_capacity_settings')
        .upsert({
          device_id: deviceId,
          channel_number: channelNumber,
          max_amperage: maxAmperage,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error updating surge capacity:', error);
        return { error: error.message };
      }

      await fetchSurgeCapacitySettings();
      return {};
    } catch (error) {
      console.error('Error in updateSurgeCapacity:', error);
      return { error: 'Failed to update surge capacity' };
    }
  };

  const voteForEnergyReset = async (deviceId: string) => {
    if (!user) return { error: 'User not authenticated' };

    try {
      const { data, error } = await supabase.functions.invoke('energy-reset-command', {
        body: { device_id: deviceId, action: 'vote' }
      });

      if (error) {
        console.error('Error voting for energy reset:', error);
        return { error: error.message };
      }

      return data;
    } catch (error) {
      console.error('Error in voteForEnergyReset:', error);
      return { error: 'Failed to vote for energy reset' };
    }
  };

  const getEnergyResetStatus = async (deviceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('energy-reset-command', {
        body: { device_id: deviceId, action: 'status' }
      });

      if (error) {
        console.error('Error getting energy reset status:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getEnergyResetStatus:', error);
      return null;
    }
  };

  const refreshData = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await fetchDeviceAssignments();
      await fetchEnergyReadings();
      await fetchTotalBillSettings();
      await fetchSurgeCapacitySettings();
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, fetchDeviceAssignments, fetchEnergyReadings, fetchTotalBillSettings, fetchSurgeCapacitySettings]);

  // Cleanup function for subscriptions
  const cleanup = useCallback(() => {
    console.log('Cleaning up EnergyContext subscriptions');
    
    subscriptionsRef.current.forEach(channel => {
      try {
        if (channel && typeof channel.unsubscribe === 'function') {
          channel.unsubscribe();
        } else {
          supabase.removeChannel(channel);
        }
      } catch (error) {
        console.error('Error removing channel:', error);
      }
    });
    subscriptionsRef.current = [];
    isSubscribedRef.current = false;
  }, []);

  // Real-time subscription setup
  const setupRealTimeSubscriptions = useCallback(() => {
    if (!user || isSubscribedRef.current || userDeviceIdsRef.current.length === 0) {
      return;
    }

    console.log('Setting up real-time subscriptions for devices:', userDeviceIdsRef.current);
    isSubscribedRef.current = true;

    // Clear existing subscriptions
    cleanup();

    const userId = user.id;
    const deviceIds = [...userDeviceIdsRef.current];

    // Subscribe to energy_data changes
    const energyChannel = supabase
      .channel(`energy_data_user_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'energy_data'
        },
        (payload) => {
          console.log('Energy data change detected:', payload);
          
          if (payload.new && 
              typeof payload.new === 'object' && 
              'device_id' in payload.new && 
              deviceIds.includes(payload.new.device_id as string)) {
            console.log('Real-time energy data update for user device:', payload.new.device_id);
            
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              setEnergyReadings(prev => {
                const newReading = payload.new as EnergyReading;
                
                const existingIndex = prev.findIndex(r => 
                  r.device_id === newReading.device_id && 
                  r.channel_number === newReading.channel_number &&
                  r.timestamp === newReading.timestamp
                );
                
                if (existingIndex !== -1) {
                  const updated = [...prev];
                  updated[existingIndex] = newReading;
                  return updated;
                } else {
                  return [newReading, ...prev];
                }
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Energy data subscription status:', status);
      });

    // Subscribe to device_assignments changes
    const deviceChannel = supabase
      .channel(`device_assignments_user_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'device_assignments',
          filter: `user_id=eq.${userId}`
        },
        () => {
          console.log('Device assignment change detected');
          fetchDeviceAssignments();
        }
      )
      .subscribe((status) => {
        console.log('Device assignments subscription status:', status);
      });

    subscriptionsRef.current = [energyChannel, deviceChannel];
  }, [user?.id, cleanup, fetchDeviceAssignments]);

  // Initial data fetch - ONLY ONCE
  useEffect(() => {
    if (user && !initialDataFetchedRef.current) {
      console.log('Loading fresh data for user:', user.id);
      initialDataFetchedRef.current = true;
      refreshData();
    } else if (!user) {
      console.log('User logged out, clearing data');
      setDeviceAssignments([]);
      setDeviceChannels([]);
      setEnergyReadings([]);
      setTotalBillSettings([]);
      setSurgeCapacitySettings([]);
      setSelectedDeviceId(null);
      setIsLoading(false);
      cleanup();
      initialDataFetchedRef.current = false;
      isSubscribedRef.current = false;
    }
  }, [user, refreshData, cleanup]);

  // Generate device channels when assignments change
  useEffect(() => {
    if (deviceAssignments.length > 0) {
      fetchDeviceChannels();
    }
  }, [deviceAssignments, fetchDeviceChannels]);

  // Set up real-time subscriptions when device IDs are available
  useEffect(() => {
    if (user && userDeviceIdsRef.current.length > 0 && !isSubscribedRef.current) {
      setupRealTimeSubscriptions();
    }
  }, [user, setupRealTimeSubscriptions]);

  // Update device IDs when assignments change
  useEffect(() => {
    const newDeviceIds = deviceAssignments.map(d => d.device_id);
    const currentDeviceIds = userDeviceIdsRef.current;
    
    if (JSON.stringify(newDeviceIds) !== JSON.stringify(currentDeviceIds)) {
      userDeviceIdsRef.current = newDeviceIds;
      
      // Only setup subscriptions if not already subscribed
      if (user && newDeviceIds.length > 0 && !isSubscribedRef.current) {
        setupRealTimeSubscriptions();
      }
    }
  }, [deviceAssignments, user, setupRealTimeSubscriptions]);

  // Clean up on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const contextValue = React.useMemo(() => ({
    deviceAssignments,
    deviceChannels,
    energyReadings,
    totalBillSettings,
    surgeCapacitySettings,
    selectedDeviceId,
    setSelectedDeviceId,
    isLoading,
    refreshData,
    assignDevice,
    updateChannelName,
    removeDevice,
    updateTotalBill,
    updateSurgeCapacity,
    voteForEnergyReset,
    getEnergyResetStatus,
  }), [
    deviceAssignments,
    deviceChannels,
    energyReadings,
    totalBillSettings,
    surgeCapacitySettings,
    selectedDeviceId,
    isLoading,
    refreshData
  ]);

  return (
    <EnergyContext.Provider value={contextValue}>
      {children}
    </EnergyContext.Provider>
  );
};
