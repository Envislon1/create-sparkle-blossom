
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEnergy } from '@/contexts/EnergyContext';
import { supabase } from '@/integrations/supabase/client';
import { Smartphone, Link } from 'lucide-react';
import { toast } from 'sonner';

const AddExistingDevice = () => {
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { refreshData } = useEnergy();

  const handleJoinDevice = async () => {
    if (!deviceId.trim()) {
      toast.error('Please enter a device ID');
      return;
    }

    if (!deviceName.trim()) {
      toast.error('Please enter a device name');
      return;
    }

    setIsLoading(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      // Check if device exists by looking for energy data from this device
      const { data: energyData, error: energyError } = await supabase
        .from('energy_data')
        .select('channel_number')
        .eq('device_id', deviceId.trim())
        .limit(1);

      if (energyError) {
        console.error('Error checking device existence:', energyError);
        toast.error('Error checking device. Please try again.');
        return;
      }

      if (!energyData || energyData.length === 0) {
        toast.error('Device not found. Please make sure the device ID is correct and the device has been set up and is sending data.');
        return;
      }

      // Get the maximum channel number to determine channel count
      const { data: maxChannelData, error: maxChannelError } = await supabase
        .from('energy_data')
        .select('channel_number')
        .eq('device_id', deviceId.trim())
        .order('channel_number', { ascending: false })
        .limit(1);

      if (maxChannelError) {
        console.error('Error getting channel count:', maxChannelError);
        toast.error('Error determining device channels. Please try again.');
        return;
      }

      const channelCount = maxChannelData && maxChannelData.length > 0 
        ? maxChannelData[0].channel_number 
        : 1; // Default to 1 if no data found

      // Check if user already has this device assigned
      const { data: userAssignment } = await supabase
        .from('device_assignments')
        .select('id')
        .eq('device_id', deviceId.trim())
        .eq('user_id', user.id)
        .single();

      if (userAssignment) {
        toast.error('You have already added this device to your dashboard.');
        return;
      }

      // Create device assignment for this user
      const { error: assignError } = await supabase
        .from('device_assignments')
        .insert({
          device_id: deviceId.trim(),
          device_name: deviceName.trim(),
          user_id: user.id,
          channel_count: channelCount
        });

      if (assignError) {
        console.error('Error assigning device:', assignError);
        toast.error(`Failed to join device: ${assignError.message}`);
        return;
      }

      toast.success('Successfully joined device!');
      setDeviceId('');
      setDeviceName('');
      await refreshData();
      
    } catch (error) {
      console.error('Error in handleJoinDevice:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="energy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-orange-600" />
          Add Existing Device
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="shared-device-id">Device ID</Label>
          <Input
            id="shared-device-id"
            placeholder="Enter the shared device ID"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Enter the 18-character device ID shared with you
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="device-display-name">Your Device Name</Label>
          <Input
            id="device-display-name"
            placeholder="e.g., Shared Office Building, Partner's House"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Choose a name to identify this device in your dashboard
          </p>
        </div>

        <Button 
          onClick={handleJoinDevice}
          disabled={isLoading || !deviceId.trim() || !deviceName.trim()}
          className="w-full bg-orange-600 hover:bg-orange-700"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Joining Device...
            </>
          ) : (
            <>
              <Link className="w-4 h-4 mr-2" />
              Join Device
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AddExistingDevice;
