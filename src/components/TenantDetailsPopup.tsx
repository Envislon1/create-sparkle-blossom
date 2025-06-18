import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEnergy } from '@/contexts/EnergyContext';
import { DollarSign, Zap } from 'lucide-react';

interface TenantDetailsPopupProps {
  tenantId: string;
  tenantName: string;
  deviceId: string;
  channelNumber: number;
  isOpen: boolean;
  onClose: () => void;
}

const TenantDetailsPopup = ({ 
  tenantId, 
  tenantName, 
  deviceId, 
  channelNumber, 
  isOpen, 
  onClose 
}: TenantDetailsPopupProps) => {
  const { energyReadings, deviceChannels } = useEnergy();

  // Get current readings for this specific tenant/channel
  const channelReadings = energyReadings
    .filter(r => r.device_id === deviceId && r.channel_number === channelNumber)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // ALWAYS display the latest energy and current values, regardless of timestamp
  let currentEnergyWh = 0;
  let currentAmperage = 0;
  let isOnline = false;

  if (channelReadings.length > 0) {
    const latest = channelReadings[0];
    
    // CRITICAL: Always display these values from the latest reading, regardless of age
    currentEnergyWh = latest.energy_wh || 0;
    currentAmperage = latest.current || 0;
    
    // Only the online status is determined by the 15-second timeout
    const isRecent = (Date.now() - new Date(latest.timestamp).getTime()) < 15000;
    isOnline = isRecent;
  }

  // Calculate current bill in Naira - using latest energy values always
  const agreedBudget = parseFloat(localStorage.getItem('agreedBudget') || '10000');
  
  // Calculate device total consumption using LATEST readings from each channel only
  const deviceTotalConsumptionWh = (() => {
    const deviceReadings = energyReadings.filter(r => r.device_id === deviceId);
    const latestReadingsByChannel = new Map();
    
    // Get the latest reading for each channel, regardless of when it was received
    deviceReadings.forEach(reading => {
      const channelKey = reading.channel_number;
      const existing = latestReadingsByChannel.get(channelKey);
      
      if (!existing || new Date(reading.timestamp) > new Date(existing.timestamp)) {
        latestReadingsByChannel.set(channelKey, reading);
      }
    });
    
    // Sum up the latest energy values from each channel - ALWAYS displayed
    let totalWh = 0;
    latestReadingsByChannel.forEach(reading => {
      totalWh += (reading.energy_wh || 0);
    });
    
    return totalWh;
  })();
  
  // Calculate proportional bill: (Channel Energy / Device Total Energy) * Agreed Budget
  const currentBillNaira = deviceTotalConsumptionWh > 0 ? (currentEnergyWh / deviceTotalConsumptionWh) * agreedBudget : 0;
  const currentUsageKwh = currentEnergyWh / 1000;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tenantName} - Billing Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <p className="text-sm text-muted-foreground">Current Bill</p>
              </div>
              <p className="text-3xl font-bold text-green-600">₦{currentBillNaira.toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <p className="text-sm text-muted-foreground">Energy Used</p>
              </div>
              <p className="text-xl font-bold">{currentUsageKwh.toFixed(3)} kWh</p>
              <p className="text-xs text-muted-foreground">{currentEnergyWh.toFixed(0)} Wh</p>
            </div>
            
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Current Draw</p>
              <p className="text-xl font-bold">{currentAmperage.toFixed(2)} A</p>
              <p className="text-xs text-muted-foreground">Channel {channelNumber}</p>
            </div>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              <p className="text-sm font-medium">
                Status: {isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Bill = (Energy Used / Device Total Consumption) × Agreed Budget
            </p>
            <p className="text-xs text-muted-foreground">
              Device Total: {(deviceTotalConsumptionWh / 1000).toFixed(3)} kWh
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TenantDetailsPopup;
