
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEnergy } from '@/contexts/EnergyContext';
import { AlertTriangle, Settings } from 'lucide-react';

const SurgeCapacityManager = () => {
  const { deviceAssignments, deviceChannels, surgeCapacitySettings, updateSurgeCapacity } = useEnergy();
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [maxAmperage, setMaxAmperage] = useState<string>('30');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || !selectedChannel) return;

    const channelNumber = parseInt(selectedChannel);
    const amperage = parseFloat(maxAmperage);

    if (isNaN(channelNumber) || isNaN(amperage) || amperage <= 0) {
      return;
    }

    await updateSurgeCapacity(selectedDevice, channelNumber, amperage);
    
    // Reset form
    setSelectedDevice('');
    setSelectedChannel('');
    setMaxAmperage('30');
  };

  const getChannelsForDevice = (deviceId: string) => {
    return deviceChannels.filter(ch => ch.device_id === deviceId);
  };

  const getCurrentSetting = (deviceId: string, channelNumber: number) => {
    return surgeCapacitySettings.find(
      s => s.device_id === deviceId && s.channel_number === channelNumber
    )?.max_amperage || 30;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          Surge Capacity Settings
        </CardTitle>
        <CardDescription>
          Configure maximum amperage thresholds for surge detection per channel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="device-select">Device</Label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  {deviceAssignments.map((device) => (
                    <SelectItem key={device.device_id} value={device.device_id}>
                      {device.custom_name || device.device_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel-select">Channel</Label>
              <Select 
                value={selectedChannel} 
                onValueChange={setSelectedChannel}
                disabled={!selectedDevice}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  {selectedDevice && getChannelsForDevice(selectedDevice).map((channel) => (
                    <SelectItem key={channel.channel_number} value={channel.channel_number.toString()}>
                      {channel.custom_name || `Channel ${channel.channel_number}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-amperage">Max Amperage (A)</Label>
              <Input
                id="max-amperage"
                type="number"
                value={maxAmperage}
                onChange={(e) => setMaxAmperage(e.target.value)}
                placeholder="30"
                min="1"
                step="0.1"
              />
            </div>
          </div>

          <Button type="submit" disabled={!selectedDevice || !selectedChannel}>
            <Settings className="w-4 h-4 mr-2" />
            Update Surge Capacity
          </Button>
        </form>

        {/* Current Settings Display */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Current Settings</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deviceAssignments.map((device) => (
              <div key={device.device_id} className="space-y-2">
                <h5 className="text-sm font-medium text-muted-foreground">
                  {device.custom_name || device.device_name}
                </h5>
                {getChannelsForDevice(device.device_id).map((channel) => (
                  <div 
                    key={`${device.device_id}-${channel.channel_number}`}
                    className="flex justify-between items-center p-2 bg-muted rounded-sm"
                  >
                    <span className="text-sm">
                      {channel.custom_name || `Channel ${channel.channel_number}`}
                    </span>
                    <span className="text-sm font-medium">
                      {getCurrentSetting(device.device_id, channel.channel_number)}A
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SurgeCapacityManager;
