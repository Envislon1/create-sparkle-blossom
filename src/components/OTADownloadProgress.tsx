import React, { useState, useEffect, useRef } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Download, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OTADownloadProgressProps {
  deviceId: string;
  deviceName: string;
}

interface DownloadStatus {
  stage: 'starting' | 'downloading' | 'installing' | 'complete' | 'failed' | 'no_update';
  progress: number;
  message: string;
}

const OTADownloadProgress: React.FC<OTADownloadProgressProps> = ({
  deviceId,
  deviceName
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({
    stage: 'complete',
    progress: 100,
    message: 'Ready for updates...'
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  // Function to reset the 5-second timeout
  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      console.log('No OTA updates received for 5 seconds, closing dialog');
      setIsOpen(false);
    }, 5000);
  };

  // Function to process OTA status updates
  const processOTAStatus = (status: string, progress: number, message: string) => {
    console.log(`Processing OTA status: ${status}, Progress: ${progress}%`);
    
    // Skip heartbeat messages
    if (status === 'heartbeat') {
      console.log('Skipping heartbeat message');
      return;
    }
    
    let newStage: DownloadStatus['stage'] = 'starting';
    let displayProgress = progress;
    let displayMessage = message;
    
    switch (status) {
      case 'starting':
        newStage = 'starting';
        displayProgress = 0;
        displayMessage = message || 'Starting firmware update...';
        console.log('OTA starting detected - showing dialog');
        setIsOpen(true);
        resetTimeout();
        break;
      case 'downloading':
        newStage = 'downloading';
        displayProgress = progress;
        displayMessage = message || `Downloading firmware... ${progress}%`;
        console.log('OTA downloading detected, progress:', displayProgress, '- showing dialog');
        setIsOpen(true);
        resetTimeout();
        break;
      case 'installing':
        newStage = 'installing';
        displayProgress = 90 + progress / 10;
        displayMessage = 'Installing firmware... Please do not power off device';
        console.log('OTA installing detected - showing dialog');
        setIsOpen(true);
        resetTimeout();
        break;
      case 'complete':
        newStage = 'complete';
        displayProgress = 100;
        displayMessage = message || 'Firmware update completed successfully!';
        console.log('OTA complete detected');
        setIsOpen(true);
        toast.success('Firmware update completed successfully!');
        // Clear timeout and close immediately when reaching 100%
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        setTimeout(() => {
          console.log('Closing dialog immediately at 100% completion');
          setIsOpen(false);
        }, 0);
        break;
      case 'failed':
        newStage = 'failed';
        displayProgress = 0;
        displayMessage = message || 'Firmware update failed';
        console.log('OTA failed detected');
        setIsOpen(true);
        toast.error('Firmware update failed');
        // Clear timeout for failed state
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        // Auto-close after showing failure for 5 seconds
        setTimeout(() => {
          console.log('Auto-closing dialog after failure');
          setIsOpen(false);
        }, 5000);
        break;
      case 'no_update':
        newStage = 'no_update';
        displayProgress = 100;
        displayMessage = message || 'No firmware updates available';
        console.log('OTA no update detected');
        setIsOpen(true);
        toast.info('Device is already up to date');
        // Clear timeout for no update state
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        // Auto-close after showing no update for 2 seconds
        setTimeout(() => {
          console.log('Auto-closing dialog after no update');
          setIsOpen(false);
        }, 2000);
        break;
      default:
        console.log('Unknown OTA status:', status);
        return;
    }
    
    console.log('Setting download status:', { stage: newStage, progress: displayProgress, message: displayMessage });
    lastUpdateRef.current = Date.now();
    
    setDownloadStatus({
      stage: newStage,
      progress: displayProgress,
      message: displayMessage
    });
  };

  useEffect(() => {
    if (!deviceId) return;

    console.log('Setting up OTA download progress listener for device:', deviceId);

    // Create subscription for database changes
    const channel = supabase
      .channel(`ota-updates-${deviceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ota_status_updates',
          filter: `device_id=eq.${deviceId}`
        },
        (payload) => {
          console.log('Received OTA status update:', payload);
          
          const record = payload.new || payload.old;
          if (!record || typeof record !== 'object') {
            console.log('No valid record data in payload');
            return;
          }
          
          // Type guard to ensure record has the expected properties
          if (!('status' in record) || !record.status) {
            console.log('No status in record');
            return;
          }
          
          // Additional type guards for progress and message
          const hasProgress = 'progress' in record;
          const hasMessage = 'message' in record;
          
          const status = record.status as string;
          const progress = hasProgress && typeof record.progress === 'number' ? record.progress : 0;
          const message = hasMessage && typeof record.message === 'string' ? record.message : '';
          
          processOTAStatus(status, progress, message);
        }
      )
      .subscribe((status) => {
        console.log('OTA channel subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to OTA updates for device:', deviceId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error for OTA updates');
        } else if (status === 'TIMED_OUT') {
          console.log('Channel subscription timed out');
        }
      });

    // Check for existing OTA status on mount - look for ANY recent activity, not just within 30 seconds
    const checkExistingStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('ota_status_updates')
          .select('*')
          .eq('device_id', deviceId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (error) {
          console.error('Error checking existing OTA status:', error);
          return;
        }
        
        if (data && data.status && data.status !== 'heartbeat') {
          console.log('Found existing OTA status:', data);
          
          // Check if the status is recent (within 5 minutes) and active
          const statusAge = new Date().getTime() - new Date(data.created_at).getTime();
          const isRecent = statusAge < 5 * 60 * 1000; // 5 minutes
          const isActiveStatus = ['starting', 'downloading', 'installing'].includes(data.status);
          
          // Only show dialog for recent active statuses, NOT for completed ones
          if (isRecent && isActiveStatus) {
            console.log('Showing dialog for existing active OTA status');
            
            const status = data.status;
            const progress = data.progress || 0;
            const message = data.message || '';
            
            processOTAStatus(status, progress, message);
          } else {
            console.log('Skipping old or inactive OTA status on load');
          }
        }
      } catch (error) {
        console.error('Error in checkExistingStatus:', error);
      }
    };

    checkExistingStatus();

    return () => {
      console.log('Cleaning up OTA download progress listener');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [deviceId]);

  const getStatusIcon = () => {
    switch (downloadStatus.stage) {
      case 'downloading':
        return <Download className="w-5 h-5 text-blue-600" />;
      case 'installing':
        return <Settings className="w-5 h-5 text-orange-600 animate-spin" />;
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
    }
  };

  const getStatusDescription = () => {
    switch (downloadStatus.stage) {
      case 'downloading':
        return `Firmware download in progress for ${deviceName}`;
      case 'installing':
        return `Installing firmware on ${deviceName}`;
      case 'complete':
        return `Firmware update completed for ${deviceName}`;
      case 'failed':
        return `Firmware update failed for ${deviceName}`;
      case 'no_update':
        return `No firmware updates available for ${deviceName}`;
      default:
        return `Preparing firmware update for ${deviceName}`;
    }
  };

  const handleClose = () => {
    console.log('User manually closed OTA progress dialog');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(false);
  };

  console.log('Rendering OTA progress dialog. isOpen:', isOpen, 'stage:', downloadStatus.stage, 'progress:', downloadStatus.progress);

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <div className="absolute right-4 top-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-6 w-6 p-0 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Firmware Update Progress
          </AlertDialogTitle>
          <AlertDialogDescription>
            {getStatusDescription()}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Updating firmware for <span className="font-medium">{deviceName}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Device ID: {deviceId}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{downloadStatus.progress.toFixed(0)}%</span>
            </div>
            
            <Progress 
              value={downloadStatus.progress} 
              className="w-full h-2"
            />
            
            <p className="text-sm text-center text-muted-foreground">
              {downloadStatus.message}
            </p>
          </div>

          {downloadStatus.stage === 'complete' && (
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✅ Update completed! Device will restart automatically.
              </p>
            </div>
          )}

          {downloadStatus.stage === 'failed' && (
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200 mb-2">
                ❌ Update failed. Please try again.
              </p>
              <ul className="text-xs text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                <li>Check device internet connection</li>
                <li>Ensure device has sufficient storage</li>
                <li>Verify firmware file is valid</li>
              </ul>
            </div>
          )}

          {downloadStatus.stage === 'installing' && (
            <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                ⚠️ Installing firmware. Do not power off the device!
              </p>
            </div>
          )}

          {downloadStatus.stage === 'no_update' && (
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                ℹ️ Device is already running the latest firmware version.
              </p>
            </div>
          )}

          {downloadStatus.stage === 'starting' && (
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                🚀 Firmware update initiated. Preparing download...
              </p>
            </div>
          )}

          {downloadStatus.stage === 'downloading' && (
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                📥 Downloading firmware... Please keep device connected.
              </p>
            </div>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default OTADownloadProgress;
