import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useEnergy } from '@/contexts/EnergyContext';
import { Activity } from 'lucide-react';

const GRADIENT_COLORS = [
  '#f97316', '#3b82f6', '#10b981', '#8b5cf6', 
  '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'
];

interface EnergyOverviewProps {
  activeDevices: number;
}

const EnergyOverview: React.FC<EnergyOverviewProps> = ({ activeDevices }) => {
  const { deviceAssignments, deviceChannels, energyReadings, totalBillSettings, selectedDeviceId } = useEnergy();

  // Filter data for selected device only
  const selectedDevice = deviceAssignments.find(d => d.device_id === selectedDeviceId);
  const selectedDeviceChannels = deviceChannels.filter(ch => ch.device_id === selectedDeviceId);
  const selectedDeviceReadings = energyReadings.filter(r => r.device_id === selectedDeviceId);
  const selectedDeviceBill = totalBillSettings.find(tb => tb.device_id === selectedDeviceId);

  const chartData = selectedDevice ? (() => {
    const totalBillAmount = selectedDeviceBill?.total_bill_amount || 0;
    
    // Calculate total energy for this device across all channels (keep in Wh)
    const deviceTotalEnergyWh = (() => {
      const latestReadingsByChannel = new Map();
      
      // Get the latest reading for each channel, regardless of when it was received
      selectedDeviceReadings.forEach(reading => {
        const channelKey = reading.channel_number;
        const existing = latestReadingsByChannel.get(channelKey);
        
        if (!existing || new Date(reading.timestamp) > new Date(existing.timestamp)) {
          latestReadingsByChannel.set(channelKey, reading);
        }
      });
      
      // Sum up the latest energy values from each channel - ALWAYS displayed
      let totalWh = 0;
      latestReadingsByChannel.forEach(reading => {
        totalWh += (reading.energy_wh || 0);
      });
      
      return totalWh;
    })();
    
    // Create chart entries for each channel, ensuring all channels are shown
    return Array.from({ length: selectedDevice.channel_count }, (_, i) => {
      const channelNumber = i + 1;
      const channel = selectedDeviceChannels.find(ch => ch.channel_number === channelNumber) || {
        custom_name: `House${channelNumber}`,
        channel_number: channelNumber
      };
      
      const channelReadings = selectedDeviceReadings.filter(r => r.channel_number === channelNumber);
      
      // ALWAYS display the latest values, regardless of timestamp age
      let channelEnergyWh = 0;
      let currentValue = 0;
      let isChannelOnline = false;
      
      if (channelReadings.length > 0) {
        const latestChannelReading = channelReadings
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        // CRITICAL: Always display these values from the latest reading
        channelEnergyWh = latestChannelReading.energy_wh || 0;
        currentValue = latestChannelReading.current || 0;
        
        // Only the online status is determined by the 15-second timeout
        const isRecent = (Date.now() - new Date(latestChannelReading.timestamp).getTime()) < 15000;
        isChannelOnline = isRecent;
      }
      
      // Calculate cost: (Channel Energy / Total Device Energy) * Total Bill
      const channelCost = deviceTotalEnergyWh > 0 ? (channelEnergyWh / deviceTotalEnergyWh) * totalBillAmount : 0;
      
      // Use channel number - 1 for consistent color indexing (House1 = index 0, House2 = index 1, etc.)
      const colorIndex = (channelNumber - 1) % GRADIENT_COLORS.length;
      
      return {
        name: channel.custom_name || `House${channelNumber}`,
        value: Number((channelEnergyWh / 1000).toFixed(2)), // Convert to kWh only for display
        current: Number(currentValue.toFixed(2)), // Always display last known current
        cost: Number(channelCost.toFixed(2)),
        color: GRADIENT_COLORS[colorIndex],
        gradientId: `gradient-${channelNumber}`,
        isOnline: isChannelOnline,
        deviceId: selectedDeviceId,
        channelNumber: channelNumber
      };
    });
  })() : [];

  // Filter data for bar chart - only show non-zero energy values
  const barChartData = chartData.filter(item => item.value > 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
          <p className="font-medium text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Energy: {data.value.toFixed(2)} kWh
          </p>
          <p className="text-sm text-muted-foreground">
            Current: {data.current.toFixed(2)} A
          </p>
          <p className="text-sm text-muted-foreground">
            Cost: #{data.cost.toFixed(2)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div 
              className={`w-2 h-2 rounded-full ${data.isOnline ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-xs text-muted-foreground">
              {data.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!selectedDevice) {
    return (
      <Card className="energy-card h-[500px] sm:h-[600px]">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-energy-600 dark:text-energy-400" />
            Energy Consumption Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-96 sm:h-[480px] flex items-center justify-center">
            <div className="text-center">
              <Activity className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm sm:text-base">No device selected</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                Please add a device or select one from the device manager
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="energy-card h-[500px] sm:h-[600px]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-energy-600 dark:text-energy-400" />
          <span className="truncate">
            Energy Overview - {selectedDevice.custom_name || selectedDevice.device_name}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <h3 className="text-sm sm:text-lg font-semibold mb-4 text-foreground">Energy Consumption (kWh)</h3>
          {barChartData.length > 0 ? (
            <div className="w-full h-96 sm:h-[480px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 20, right: 10, left: 10, bottom: 60 }}>
                  <defs>
                    {barChartData.map((entry, index) => (
                      <linearGradient
                        key={entry.gradientId}
                        id={entry.gradientId}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="5%" stopColor={entry.color} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={entry.color} stopOpacity={0.3}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {barChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#${entry.gradientId})`}
                        stroke={entry.isOnline ? entry.color : '#9ca3af'}
                        strokeWidth={entry.isOnline ? 1 : 2}
                        strokeDasharray={entry.isOnline ? '0' : '5,5'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="w-full h-96 sm:h-[480px] flex items-center justify-center">
              <div className="text-center">
                <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs sm:text-sm text-muted-foreground">No energy data available</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EnergyOverview;
