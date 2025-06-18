
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEnergy } from '@/contexts/EnergyContext';
import { useDeviceOnlineStatus } from '@/hooks/useDeviceOnlineStatus';
import { Settings, Wifi } from 'lucide-react';
import OTAManager from './OTAManager';

const EnhancedDeviceOverview = () => {
  const { deviceAssignments } = useEnergy();
  const { isDeviceOnline } = useDeviceOnlineStatus();
  const [isOTADialogOpen, setIsOTADialogOpen] = useState(false);

  const handleConfigureClick = () => {
    setIsOTADialogOpen(true);
  };

  // Listen for upload completion to auto-close the dialog
  useEffect(() => {
    const handleUploadComplete = () => {
      console.log('Upload completed, closing OTA Manager dialog');
      setIsOTADialogOpen(false);
    };

    // Listen for custom event from OTAManager
    window.addEventListener('otaUploadComplete', handleUploadComplete);

    return () => {
      window.removeEventListener('otaUploadComplete', handleUploadComplete);
    };
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deviceAssignments.map((device) => {
          const isOnline = isDeviceOnline(device.device_id);
          
          return (
            <Card key={device.device_id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{device.custom_name || device.device_name}</CardTitle>
                    <CardDescription>{device.device_id}</CardDescription>
                  </div>
                  <Wifi className={`h-4 w-4 ${isOnline ? 'text-green-500' : 'text-gray-400'}`} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Channels:</span>
                  <span>{device.channel_count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Device Name:</span>
                  <span className="truncate ml-2">{device.device_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Added:</span>
                  <span>{new Date(device.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Status:</span>
                  <Badge variant={isOnline ? "default" : "secondary"} className="text-xs">
                    {isOnline ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={handleConfigureClick}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {deviceAssignments.length === 0 && (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">No devices found. Add a device to get started.</p>
          </div>
        )}
      </div>

      <Dialog open={isOTADialogOpen} onOpenChange={setIsOTADialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Device Configuration - OTA Manager</DialogTitle>
          </DialogHeader>
          <OTAManager onUploadComplete={() => setIsOTADialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EnhancedDeviceOverview;
