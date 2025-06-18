
import React from 'react';
import { useEnergy } from '@/contexts/EnergyContext';
import OTADownloadProgress from './OTADownloadProgress';

const GlobalOTAProgressMonitor = () => {
  const { deviceAssignments } = useEnergy();

  return (
    <>
      {deviceAssignments.map((device) => (
        <OTADownloadProgress
          key={device.device_id}
          deviceId={device.device_id}
          deviceName={device.custom_name || device.device_name}
        />
      ))}
    </>
  );
};

export default GlobalOTAProgressMonitor;
