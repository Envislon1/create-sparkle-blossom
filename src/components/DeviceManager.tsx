
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AddNewDevice from './AddNewDevice';
import AddExistingDevice from './AddExistingDevice';
import DeviceChannelManager from './DeviceChannelManager';
import EnergyResetVoting from './EnergyResetVoting';

const DeviceManager = () => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="add-new" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="add-new">Add New</TabsTrigger>
          <TabsTrigger value="add-existing">Add Existing</TabsTrigger>
          <TabsTrigger value="manage">Manage Devices</TabsTrigger>
          <TabsTrigger value="reset">Reset Energy</TabsTrigger>
        </TabsList>
        
        <TabsContent value="add-new" className="space-y-4">
          <AddNewDevice />
        </TabsContent>
        
        <TabsContent value="add-existing" className="space-y-4">
          <AddExistingDevice />
        </TabsContent>
        
        <TabsContent value="manage" className="space-y-4">
          <DeviceChannelManager />
        </TabsContent>
        
        <TabsContent value="reset" className="space-y-4">
          <EnergyResetVoting />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DeviceManager;
