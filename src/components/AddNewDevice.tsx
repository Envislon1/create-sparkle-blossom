
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEnergy } from '@/contexts/EnergyContext';
import { Smartphone, Plus } from 'lucide-react';
import { toast } from 'sonner';

const AddNewDevice = () => {
  const [deviceName, setDeviceName] = useState('');
  const [channelCount, setChannelCount] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const { assignDevice } = useEnergy();

  const generateObfuscatedDeviceId = () => {
    const now = new Date();
    const timestamp = now.getTime();
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    
    // Convert timestamp to a mixed base representation
    let timeStr = timestamp.toString(36); // Base 36 gives us numbers + letters
    
    // Add some random characters and shuffle
    const randomChars = Array.from({ length: 6 }, () => 
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    
    // Combine timestamp string with random chars
    let combined = timeStr + randomChars;
    
    // If too long, truncate; if too short, pad with random chars
    while (combined.length < 18) {
      combined += chars[Math.floor(Math.random() * chars.length)];
    }
    
    // Shuffle the string to make it less obvious
    const shuffled = combined
      .slice(0, 18)
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
    
    return shuffled;
  };

  const handleAssignDevice = async () => {
    if (!deviceName.trim()) {
      toast.error('Please enter a device name');
      return;
    }

    const channels = parseInt(channelCount);
    if (channels < 1 || channels > 16) {
      toast.error('Channel count must be between 1 and 16');
      return;
    }

    // Generate device ID when adding the device
    const deviceId = generateObfuscatedDeviceId();

    setIsLoading(true);
    const { error } = await assignDevice(deviceId, deviceName.trim(), channels);
    
    if (error) {
      toast.error(`Failed to add device: ${error}`);
    } else {
      toast.success('Device added successfully!');
      setDeviceName('');
      setChannelCount('1');
    }
    setIsLoading(false);
  };

  return (
    <Card className="energy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-orange-600" />
          Add New Device
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="device-name">Device Name</Label>
          <Input
            id="device-name"
            placeholder="e.g., Main House, Office Building"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="channel-count">Number of Channels</Label>
          <Input
            id="channel-count"
            type="number"
            min="1"
            max="16"
            placeholder="1"
            value={channelCount}
            onChange={(e) => setChannelCount(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Number of current sensors (1-16 channels)
          </p>
        </div>

        <Button 
          onClick={handleAssignDevice}
          disabled={isLoading || !deviceName.trim()}
          className="w-full bg-orange-600 hover:bg-orange-700"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Adding Device...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AddNewDevice;
