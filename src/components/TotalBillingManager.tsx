
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEnergy } from '@/contexts/EnergyContext';
import { Calculator, Users, Smartphone } from 'lucide-react';

const TotalBillingManager = () => {
  const { 
    deviceAssignments, 
    deviceChannels,
    energyReadings, 
    totalBillSettings, 
    updateTotalBill 
  } = useEnergy();
  
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [agreedBudget, setAgreedBudget] = useState(10000);

  // Load agreed budget from localStorage
  useEffect(() => {
    const savedBudget = localStorage.getItem('agreedBudget');
    if (savedBudget) {
      setAgreedBudget(parseFloat(savedBudget));
    }
  }, []);

  // Listen for changes to localStorage (when updated from Settings)
  useEffect(() => {
    const handleStorageChange = () => {
      const savedBudget = localStorage.getItem('agreedBudget');
      if (savedBudget) {
        setAgreedBudget(parseFloat(savedBudget));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Auto-apply budget when device is selected or budget changes
  useEffect(() => {
    if (selectedDeviceId && agreedBudget > 0) {
      updateTotalBill(selectedDeviceId, agreedBudget);
    }
  }, [selectedDeviceId, agreedBudget, updateTotalBill]);

  // Calculate total energy consumption for selected device (get latest reading per channel) - ALWAYS retain values
  const calculateTotalConsumption = (deviceId: string) => {
    if (!deviceId) return 0;
    
    // Get the latest reading for each channel of this device
    const deviceReadings = energyReadings.filter(reading => reading.device_id === deviceId);
    
    // Group by channel and get the latest reading for each
    const latestReadingsByChannel = new Map();
    
    deviceReadings.forEach(reading => {
      const channelKey = reading.channel_number;
      const existing = latestReadingsByChannel.get(channelKey);
      
      if (!existing || new Date(reading.timestamp) > new Date(existing.timestamp)) {
        latestReadingsByChannel.set(channelKey, reading);
      }
    });
    
    // Sum up the latest energy values (convert Wh to kWh) - ALWAYS use latest values regardless of online status
    let totalConsumptionKwh = 0;
    latestReadingsByChannel.forEach(reading => {
      totalConsumptionKwh += (reading.energy_wh || 0) / 1000;
    });
    
    console.log('Total consumption calculation:', {
      deviceId,
      channelsFound: latestReadingsByChannel.size,
      totalConsumptionKwh,
      latestReadings: Array.from(latestReadingsByChannel.entries())
    });
    
    return totalConsumptionKwh;
  };

  // Calculate proportional billing for each channel under selected device
  const calculateProportionalBilling = () => {
    if (!selectedDeviceId) return [];

    const selectedDevice = deviceAssignments.find(d => d.device_id === selectedDeviceId);
    if (!selectedDevice) return [];

    const totalConsumption = calculateTotalConsumption(selectedDeviceId);
    
    // Get the latest reading for each channel of this device
    const deviceReadings = energyReadings.filter(reading => reading.device_id === selectedDeviceId);
    
    // Group by channel and get the latest reading for each
    const latestReadingsByChannel = new Map();
    
    deviceReadings.forEach(reading => {
      const channelKey = reading.channel_number;
      const existing = latestReadingsByChannel.get(channelKey);
      
      if (!existing || new Date(reading.timestamp) > new Date(existing.timestamp)) {
        latestReadingsByChannel.set(channelKey, reading);
      }
    });
    
    // Generate channels based on device channel count
    return Array.from({ length: selectedDevice.channel_count }, (_, i) => {
      const channelNumber = i + 1;
      
      // Get custom name from deviceChannels if available, otherwise use default
      const customChannel = deviceChannels.find(ch => 
        ch.device_id === selectedDeviceId && ch.channel_number === channelNumber
      );
      const customName = customChannel?.custom_name || `House${channelNumber}`;
      
      // Get latest reading for this channel
      const latestReading = latestReadingsByChannel.get(channelNumber);
      
      // Convert Wh to kWh for channel consumption - ALWAYS use latest value regardless of online status
      const channelConsumption = latestReading ? (latestReading.energy_wh || 0) / 1000 : 0;
      
      const percentage = totalConsumption > 0 ? (channelConsumption / totalConsumption) * 100 : 0;
      const proportionalAmount = totalConsumption > 0 ? (channelConsumption / totalConsumption) * agreedBudget : 0;
      
      console.log('Channel calculation:', {
        channelNumber,
        customName,
        latestReading: latestReading ? {
          timestamp: latestReading.timestamp,
          energy_wh: latestReading.energy_wh,
          current: latestReading.current
        } : null,
        channelConsumption,
        percentage,
        proportionalAmount
      });
      
      return {
        channel: {
          id: `${selectedDeviceId}_${channelNumber}`,
          custom_name: customName,
          channel_number: channelNumber,
          device_id: selectedDeviceId
        },
        consumption: channelConsumption, // Already in kWh
        percentage: percentage,
        proportionalAmount: proportionalAmount
      };
    });
  };

  const proportionalData = calculateProportionalBilling();
  const totalConsumption = selectedDeviceId ? calculateTotalConsumption(selectedDeviceId) : 0; // Already in kWh
  const selectedDevice = deviceAssignments.find(d => d.device_id === selectedDeviceId);

  return (
    <div className="space-y-6">
      {/* Device Selection */}
      <Card className="energy-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-orange-600" />
            Total Energy Bill Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {deviceAssignments.length === 0 ? (
            <div className="text-center py-8">
              <Smartphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-2">No devices assigned</p>
              <p className="text-sm text-muted-foreground">
                You need to assign a device first to manage billing. 
                Check the "My Devices" section to add devices.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Select Device</Label>
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a device to manage billing" />
                </SelectTrigger>
                <SelectContent>
                  {deviceAssignments.map(assignment => (
                    <SelectItem key={assignment.device_id} value={assignment.device_id}>
                      {assignment.device_name} ({assignment.device_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proportional Billing Breakdown */}
      {selectedDeviceId && agreedBudget > 0 && (
        <Card className="energy-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              Proportional Billing Breakdown - {selectedDevice?.device_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                <p>Total Consumption: {totalConsumption.toFixed(2)} kWh</p>
                <p>Total Bill: #{agreedBudget.toFixed(2)}</p>
                <p>Device: {selectedDevice?.device_name} ({selectedDeviceId})</p>
              </div>

              {proportionalData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No channels available for this device</p>
                  <p className="text-sm mt-2">Energy consumption data will appear once channels start reporting</p>
                </div>
              ) : (
                proportionalData.map((data, index) => (
                  <div key={data.channel.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-foreground">{data.channel.custom_name}</h4>
                        <p className="text-xs text-muted-foreground">Channel {data.channel.channel_number}</p>
                      </div>
                      <span className="text-lg font-bold text-orange-600">
                        #{data.proportionalAmount.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Consumption</p>
                        <p className="font-medium">{data.consumption.toFixed(2)} kWh</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Usage %</p>
                        <p className="font-medium">{data.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(data.percentage, 1)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TotalBillingManager;
