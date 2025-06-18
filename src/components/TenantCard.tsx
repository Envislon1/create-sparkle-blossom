
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Power } from 'lucide-react';

interface TenantCardProps {
  name: string;
  deviceId: string;
  channels: number[];
  currentUsage: number;
  monthlyBudget: number;
  currentBill: number;
  ratePerKwh: number;
  currentAmps: number[];
}

const TenantCard = ({
  name,
  deviceId,
  channels,
  currentUsage,
  monthlyBudget,
  currentBill,
  ratePerKwh,
  currentAmps
}: TenantCardProps) => {
  const usagePercent = monthlyBudget > 0 ? (currentBill / monthlyBudget) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {name}
          <Badge variant="outline">
            <Power className="h-3 w-3 mr-1" />
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current Usage</p>
            <p className="text-2xl font-bold">{currentUsage.toFixed(3)} kWh</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Bill</p>
            <p className="text-2xl font-bold">#{currentBill.toFixed(2)}</p>
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-2">Budget Usage</p>
          <Progress value={usagePercent} className="mb-2" />
          <div className="flex justify-between text-sm">
            <span>{usagePercent.toFixed(1)}% of budget used</span>
            <Badge
              variant={usagePercent > 100 ? "destructive" : usagePercent > 75 ? "secondary" : "default"}
            >
              {usagePercent > 100 ? "Over Budget" : usagePercent > 75 ? "High Usage" : "Normal"}
            </Badge>
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-2">Channel Currents (Amps)</p>
          <div className="space-y-2">
            {currentAmps.map((current, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm">Channel {channels[index]}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min((current / 20) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium w-12">{current.toFixed(1)}A</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex justify-between text-sm">
            <span>Budget:</span>
            <span>#{monthlyBudget.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Budget Remaining:</span>
            <span>#{Math.max(monthlyBudget - currentBill, 0).toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TenantCard;
