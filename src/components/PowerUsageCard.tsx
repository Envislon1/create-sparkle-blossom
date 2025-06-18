
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useEnergy } from '@/contexts/EnergyContext';
import { Activity, Wifi, WifiOff } from 'lucide-react';

interface PowerUsageCardProps {
  name: string;
  deviceId: string;
  channels: number[];
  currentAmps: number[];
}

const PowerUsageCard = ({ name, deviceId, channels, currentAmps }: PowerUsageCardProps) => {
  const { energyReadings, surgeCapacitySettings } = useEnergy();

  // Calculate if this tenant is online
  const isOnline = () => {
    const recentReadings = energyReadings.filter(reading => {
      if (reading.device_id !== deviceId) return false;
      if (!channels.includes(reading.channel_number)) return false;
      
      const isRecent = (Date.now() - new Date(reading.timestamp).getTime()) < 15000;
      return isRecent;
    });
    
    return recentReadings.length > 0;
  };

  // Calculate max current for this tenant's channels
  const getMaxCurrent = () => {
    let maxCurrent = 30; // Default max current
    
    for (const channelNumber of channels) {
      const setting = surgeCapacitySettings.find(
        s => s.device_id === deviceId && s.channel_number === channelNumber
      );
      if (setting) {
        maxCurrent = Math.max(maxCurrent, setting.max_amperage);
      }
    }
    
    return maxCurrent;
  };

  const totalCurrent = currentAmps.reduce((sum, amp) => sum + amp, 0);
  const maxCurrent = getMaxCurrent();
  const usagePercentage = maxCurrent > 0 ? (totalCurrent / maxCurrent) * 100 : 0;
  const online = isOnline();

  // Determine status color based on usage percentage
  const getStatusColor = () => {
    if (usagePercentage >= 80) return 'text-red-600 dark:text-red-400';
    if (usagePercentage >= 60) return 'text-orange-600 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getProgressColor = () => {
    if (usagePercentage >= 80) return 'bg-red-500';
    if (usagePercentage >= 60) return 'bg-orange-500';
    return 'bg-green-500';
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-semibold">{name}</span>
          </div>
          <div className="flex items-center gap-1">
            {online ? (
              <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
            )}
            <span className={`text-xs font-medium ${online ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Power Usage Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Power Usage</span>
            <span className={`text-sm font-bold ${getStatusColor()}`}>
              {usagePercentage.toFixed(1)}%
            </span>
          </div>
          
          <Progress 
            value={Math.min(usagePercentage, 100)} 
            className="h-3"
            style={{
              '--progress-foreground': getProgressColor()
            } as React.CSSProperties}
          />
          
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{totalCurrent.toFixed(2)} A</span>
            <span>Max: {maxCurrent} A</span>
          </div>
        </div>

        {/* Current Details */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Channel Details</h4>
          {channels.map((channel, index) => (
            <div key={channel} className="flex justify-between items-center p-2 bg-muted/50 rounded-sm">
              <span className="text-sm">Channel {channel}</span>
              <span className="text-sm font-medium">
                {currentAmps[index]?.toFixed(2) || '0.00'} A
              </span>
            </div>
          ))}
        </div>

        {/* Status Indicator */}
        <div className="text-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
            usagePercentage >= 80 
              ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              : usagePercentage >= 60
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
              : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
          }`}>
            {usagePercentage >= 80 ? '⚠️ High Usage' : usagePercentage >= 60 ? '⚡ Moderate Usage' : '✅ Normal Usage'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PowerUsageCard;
