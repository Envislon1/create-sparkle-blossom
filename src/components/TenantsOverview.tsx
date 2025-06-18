import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useEnergy } from '@/contexts/EnergyContext';
import TenantDetailsPopup from './TenantDetailsPopup';

const TenantsOverview = () => {
  const { deviceAssignments, energyReadings, deviceChannels, surgeCapacitySettings } = useEnergy();
  const [selectedTenant, setSelectedTenant] = useState<{
    id: string;
    name: string;
    deviceId: string;
    channelNumber: number;
  } | null>(null);

  // Generate tenant data based on real devices and channels
  const generateTenantData = () => {
    const tenants = [];
    let tenantIndex = 1;
    
    // Get agreed budget from local storage or default to 10000
    const agreedBudget = parseFloat(localStorage.getItem('agreedBudget') || '10000');
    
    // Calculate total number of tenants first
    let totalTenants = 0;
    deviceAssignments.forEach((device) => {
      const deviceChannelsForDevice = deviceChannels.filter(ch => ch.device_id === device.device_id);
      totalTenants += deviceChannelsForDevice.length;
    });
    
    // Calculate budget per tenant
    const budgetPerTenant = totalTenants > 0 ? agreedBudget / totalTenants : 0;
    
    // Calculate total consumption in Wh across all channels using latest readings only
    const totalConsumptionWh = (() => {
      let totalWh = 0;
      deviceAssignments.forEach((device) => {
        const deviceChannelsForDevice = deviceChannels.filter(ch => ch.device_id === device.device_id);
        const deviceReadings = energyReadings.filter(r => r.device_id === device.device_id);
        
        deviceChannelsForDevice.forEach((channel) => {
          const channelReadings = deviceReadings
            .filter(r => r.channel_number === channel.channel_number)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          if (channelReadings.length > 0) {
            const latest = channelReadings[0];
            // ALWAYS use the latest energy value, regardless of timestamp age
            totalWh += (latest.energy_wh || 0);
          }
        });
      });
      return totalWh;
    })();
    
    deviceAssignments.forEach((device) => {
      const deviceChannelsForDevice = deviceChannels.filter(ch => ch.device_id === device.device_id);
      const deviceReadings = energyReadings.filter(r => r.device_id === device.device_id);
      
      // Create individual tenants for each channel
      deviceChannelsForDevice.forEach((channel) => {
        const channelReadings = deviceReadings
          .filter(r => r.channel_number === channel.channel_number)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        // ALWAYS display the latest values, regardless of timestamp age
        let currentEnergyWh = 0;
        let currentAmperage = 0;
        let isOnline = false;
        
        if (channelReadings.length > 0) {
          const latest = channelReadings[0];
          
          // CRITICAL: Always display the latest energy and amperage values
          currentEnergyWh = latest.energy_wh || 0;
          currentAmperage = latest.current || 0;
          
          // Only the online status is determined by the 15-second timeout
          const isRecent = (Date.now() - new Date(latest.timestamp).getTime()) < 15000;
          isOnline = isRecent;
        }

        const currentUsageWh = currentEnergyWh;
        
        // Calculate proportional bill based on consumption
        const currentBill = totalConsumptionWh > 0 ? (currentEnergyWh / totalConsumptionWh) * agreedBudget : 0;
        
        // Get surge capacity setting for this device/channel (default to 30A)
        const surgeCapacity = surgeCapacitySettings.find(
          s => s.device_id === device.device_id && s.channel_number === channel.channel_number
        )?.max_amperage || 30;
        
        // Calculate surge percentage and determine status
        const surgePercentage = surgeCapacity > 0 ? (currentAmperage / surgeCapacity) * 100 : 0;
        let surgeStatus = 'normal';
        if (surgePercentage >= 76) {
          surgeStatus = 'risky';
        } else if (surgePercentage >= 61) {
          surgeStatus = 'high';
        }
        
        tenants.push({
          id: `tenant-${tenantIndex}`,
          name: `Tenant ${tenantIndex}`,
          deviceId: device.device_id,
          channelNumber: channel.channel_number,
          channelName: channel.custom_name || `Channel ${channel.channel_number}`,
          currentUsage: currentUsageWh, // ALWAYS displayed from latest reading
          currentAmperage: currentAmperage, // ALWAYS displayed from latest reading
          budget: budgetPerTenant,
          currentBill: currentBill,
          isOnline,
          surgeCapacity,
          surgeStatus,
          surgePercentage
        });
        
        tenantIndex++;
      });
    });
    
    return tenants;
  };

  const tenants = generateTenantData();

  const handleViewDetails = (tenant: any) => {
    setSelectedTenant({
      id: tenant.id,
      name: tenant.name,
      deviceId: tenant.deviceId,
      channelNumber: tenant.channelNumber
    });
  };

  const getSurgeVariant = (status: string) => {
    switch (status) {
      case 'risky': return 'destructive';
      case 'high': return 'secondary';
      default: return 'default';
    }
  };

  const getSurgeLabel = (status: string, percentage: number) => {
    return `${status.charAt(0).toUpperCase() + status.slice(1)} (${percentage.toFixed(0)}%)`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tenant Consumption Overview</CardTitle>
          <CardDescription>Monitor individual tenant energy usage and surge detection</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Current Usage</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Current (A)</TableHead>
                <TableHead>Surge</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => {
                // Calculate total consumption across all tenants for accurate gauge percentage
                const totalConsumptionKwh = tenants.reduce((sum, t) => sum + (t.currentUsage / 1000), 0);
                
                // Usage gauge = (Current usage / Total consumption) * 100%
                const usagePercent = totalConsumptionKwh > 0 ? ((tenant.currentUsage / 1000) / totalConsumptionKwh) * 100 : 0;
                
                return (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="flex items-center gap-2">
                          {tenant.name}
                          <div className={`w-2 h-2 rounded-full ${tenant.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {tenant.channelName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{(tenant.currentUsage / 1000).toFixed(3)} kWh</div>
                        <Progress value={usagePercent} className="w-20 h-2 mt-1" />
                        <div className="text-xs text-muted-foreground mt-1">
                          {usagePercent.toFixed(1)}% of total
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>₦{tenant.budget.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{tenant.currentAmperage.toFixed(2)} A</div>
                      <div className="text-xs text-muted-foreground">
                        Max: {tenant.surgeCapacity}A
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSurgeVariant(tenant.surgeStatus)}>
                        {getSurgeLabel(tenant.surgeStatus, tenant.surgePercentage)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewDetails(tenant)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {tenants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No tenants configured. Add devices and channels to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedTenant && (
        <TenantDetailsPopup
          tenantId={selectedTenant.id}
          tenantName={selectedTenant.name}
          deviceId={selectedTenant.deviceId}
          channelNumber={selectedTenant.channelNumber}
          isOpen={!!selectedTenant}
          onClose={() => setSelectedTenant(null)}
        />
      )}
    </>
  );
};

export default TenantsOverview;
