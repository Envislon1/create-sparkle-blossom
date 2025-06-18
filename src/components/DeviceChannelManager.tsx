import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEnergy } from '@/contexts/EnergyContext';
import { Edit2, Home, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const DeviceChannelManager = () => {
  const { deviceAssignments, deviceChannels, updateChannelName, removeDevice, updateTotalBill, totalBillSettings } = useEnergy();
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [agreedBudget, setAgreedBudget] = useState(10000);

  // Load agreed budget from localStorage and sync with device bills
  useEffect(() => {
    const savedBudget = localStorage.getItem('agreedBudget');
    if (savedBudget) {
      const budget = parseFloat(savedBudget);
      setAgreedBudget(budget);
      
      // Auto-sync all device bills with the agreed budget
      deviceAssignments.forEach(device => {
        const currentBill = totalBillSettings.find(tb => tb.device_id === device.device_id);
        if (!currentBill || currentBill.total_bill_amount !== budget) {
          updateTotalBill(device.device_id, budget);
        }
      });
    }
  }, [deviceAssignments, totalBillSettings, updateTotalBill]);

  // Listen for storage changes (when updated from Settings)
  useEffect(() => {
    const handleStorageChange = () => {
      const savedBudget = localStorage.getItem('agreedBudget');
      if (savedBudget) {
        const budget = parseFloat(savedBudget);
        setAgreedBudget(budget);
        
        // Auto-sync all device bills with the new agreed budget
        deviceAssignments.forEach(device => {
          updateTotalBill(device.device_id, budget);
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [deviceAssignments, updateTotalBill]);

  const handleUpdateChannelName = async (deviceId: string, channelNumber: number) => {
    if (!newChannelName.trim()) {
      toast.error('Please enter a valid name');
      return;
    }

    const result = await updateChannelName(deviceId, channelNumber, newChannelName.trim());
    if (result.error) {
      toast.error(`Failed to update name: ${result.error}`);
    } else {
      toast.success('Channel name updated successfully!');
      setEditingChannel(null);
      setNewChannelName('');
    }
  };

  const handleRemoveDevice = async (deviceId: string, deviceName: string) => {
    if (confirm(`Are you sure you want to remove "${deviceName}"? This will delete all associated channels, energy data, and settings. This action cannot be undone.`)) {
      const result = await removeDevice(deviceId);
      if (result.error) {
        toast.error(`Failed to remove device: ${result.error}`);
      } else {
        toast.success('Device removed successfully!');
      }
    }
  };

  return (
    <div className="space-y-4">
      {deviceAssignments.map((device) => {
        const channels = deviceChannels.filter(ch => ch.device_id === device.device_id);

        return (
          <Card key={device.device_id} className="energy-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Home className="w-5 h-5 text-orange-600" />
                  {device.custom_name || device.device_name}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveDevice(device.device_id, device.custom_name || device.device_name)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Device ID: {device.device_id}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Channels Management */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Channels ({channels.length})</h4>
                {channels.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground bg-muted/50 rounded-lg">
                    <p>No channels found for this device.</p>
                    <p className="text-xs mt-1">Channels should be automatically created when adding a device.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {channels.map((channel) => (
                      <div key={channel.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Ch{channel.channel_number}:</span>
                          {editingChannel === `${channel.device_id}-${channel.channel_number}` ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={newChannelName}
                                onChange={(e) => setNewChannelName(e.target.value)}
                                className="h-6 text-sm"
                                placeholder="Channel name"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleUpdateChannelName(channel.device_id, channel.channel_number)}
                                className="h-6 px-2"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingChannel(null);
                                  setNewChannelName('');
                                }}
                                className="h-6 px-2"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="font-medium">{channel.custom_name || 'Unnamed Channel'}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingChannel(`${channel.device_id}-${channel.channel_number}`);
                                  setNewChannelName(channel.custom_name || '');
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {deviceAssignments.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No devices found. Add a device to get started.</p>
        </div>
      )}
    </div>
  );
};

export default DeviceChannelManager;
