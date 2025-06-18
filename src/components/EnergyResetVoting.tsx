
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEnergy } from '@/contexts/EnergyContext';
import { RotateCcw } from 'lucide-react';
import EnergyResetCard from './EnergyResetCard';

const EnergyResetVoting = () => {
  const { deviceAssignments } = useEnergy();

  return (
    <div className="space-y-4">
      {deviceAssignments.length === 0 ? (
        <Card className="energy-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-energy-600 dark:text-energy-400" />
              Energy Reset Voting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground">No devices available for reset</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        deviceAssignments.map((device) => (
          <EnergyResetCard
            key={device.device_id}
            deviceId={device.device_id}
            deviceName={device.custom_name || device.device_name}
          />
        ))
      )}
    </div>
  );
};

export default EnergyResetVoting;
