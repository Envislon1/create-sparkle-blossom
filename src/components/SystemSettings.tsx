
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useEnergy } from '@/contexts/EnergyContext';
import { Settings, DollarSign, Users, Save } from 'lucide-react';
import { toast } from 'sonner';

const SystemSettings = () => {
  const { deviceAssignments, deviceChannels, updateTotalBill } = useEnergy();
  const [agreedBudget, setAgreedBudget] = useState('10000');
  const [isSaving, setIsSaving] = useState(false);

  // Load agreed budget from localStorage on component mount
  useEffect(() => {
    const savedBudget = localStorage.getItem('agreedBudget');
    if (savedBudget) {
      setAgreedBudget(savedBudget);
    }
  }, []);

  // Listen for changes from other components (like DeviceChannelManager)
  useEffect(() => {
    const handleStorageChange = () => {
      const savedBudget = localStorage.getItem('agreedBudget');
      if (savedBudget) {
        setAgreedBudget(savedBudget);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Calculate total tenants (total number of channels across all devices)
  const totalTenants = deviceChannels.length;

  // Calculate individual tenant budget
  const individualBudget = totalTenants > 0 ? parseFloat(agreedBudget) / totalTenants : 0;

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('agreedBudget', agreedBudget);
      
      // Sync all device bills with the new agreed budget
      const budget = parseFloat(agreedBudget);
      const updatePromises = deviceAssignments.map(device => 
        updateTotalBill(device.device_id, budget)
      );
      
      await Promise.all(updatePromises);
      
      // Trigger storage event for other components
      window.dispatchEvent(new Event('storage'));
      
      toast.success('Settings saved and synced with all devices!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Global Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agreed-budget" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Agreed Budget (Total)
              </Label>
              <Input
                id="agreed-budget"
                type="number"
                value={agreedBudget}
                onChange={(e) => setAgreedBudget(e.target.value)}
                placeholder="Enter total agreed budget"
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground">
                This budget will be synced across all device bills and used for calculations
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Total Tenants</span>
                </div>
                <p className="text-2xl font-bold">{totalTenants}</p>
                <p className="text-xs text-muted-foreground">
                  Based on configured channels
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Budget per Tenant</span>
                </div>
                <p className="text-2xl font-bold">#{individualBudget.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  {totalTenants > 0 ? `#${agreedBudget} ÷ ${totalTenants} tenants` : 'No tenants configured'}
                </p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How Budget Calculation Works</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• <strong>Individual Budget:</strong> Agreed Budget ÷ Total Tenants</li>
                <li>• <strong>Tenant Bill:</strong> (Tenant Consumption ÷ Total Consumption) × Agreed Budget</li>
                <li>• <strong>Budget Status:</strong> Based on individual budget vs actual bill</li>
                <li>• <strong>Synchronization:</strong> Changes here update all device Total Monthly Bills</li>
              </ul>
            </div>

            <div className="flex justify-start">
              <Button 
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="flex-1 max-w-md"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Total Devices:</span>
              <span className="ml-2">{deviceAssignments.length}</span>
            </div>
            <div>
              <span className="font-medium">Total Channels:</span>
              <span className="ml-2">{deviceChannels.length}</span>
            </div>
            <div>
              <span className="font-medium">Energy Unit:</span>
              <span className="ml-2">kWh (converted from Wh)</span>
            </div>
            <div>
              <span className="font-medium">Currency:</span>
              <span className="ml-2">Nigerian Naira (#)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemSettings;
