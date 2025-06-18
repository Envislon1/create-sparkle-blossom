
import { useState, useCallback, useEffect } from 'react';
import { useEnergy } from '@/contexts/EnergyContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface VoteStatus {
  currentVotes: number;
  totalRequired: number;
  userHasVoted: boolean;
  votes: any[];
}

export const useEnergyResetVoting = (deviceId: string) => {
  const { voteForEnergyReset, getEnergyResetStatus, deviceAssignments, deviceChannels } = useEnergy();
  const { user } = useAuth();
  const [isVoting, setIsVoting] = useState(false);
  const [voteStatus, setVoteStatus] = useState<VoteStatus>({
    currentVotes: 0,
    totalRequired: 1,
    userHasVoted: false,
    votes: []
  });

  const loadVoteStatus = useCallback(async () => {
    if (!deviceId || !user?.id) {
      console.log('Skipping vote status load - missing deviceId or user');
      return;
    }
    
    try {
      console.log('Loading vote status for device:', deviceId);
      
      // Get the device assignment to determine channel count
      const device = deviceAssignments.find(d => d.device_id === deviceId);
      const deviceChannelsForDevice = deviceChannels.filter(ch => ch.device_id === deviceId);
      const totalRequiredVotes = device?.channel_count || deviceChannelsForDevice.length || 1;
      
      const status = await getEnergyResetStatus(deviceId);
      console.log('Received status:', status);
      
      if (status) {
        const userHasVoted = Array.isArray(status.votes) && status.votes.some((vote: any) => vote.user_id === user.id);
        
        const newStatus = {
          currentVotes: status.votes_received || status.votes?.length || 0,
          totalRequired: totalRequiredVotes,
          userHasVoted: userHasVoted,
          votes: status.votes || []
        };
        
        console.log('Setting vote status:', newStatus);
        setVoteStatus(newStatus);
      } else {
        console.log('No status received, using defaults');
        setVoteStatus({
          currentVotes: 0,
          totalRequired: totalRequiredVotes,
          userHasVoted: false,
          votes: []
        });
      }
    } catch (error) {
      console.error('Failed to load vote status:', error);
      toast.error('Failed to load voting status');
    }
  }, [deviceId, getEnergyResetStatus, user?.id, deviceAssignments, deviceChannels]);

  useEffect(() => {
    loadVoteStatus();
  }, [loadVoteStatus]);

  const handleVote = async () => {
    if (!deviceId) {
      toast.error('Please select a device first');
      return;
    }

    if (!user?.id) {
      toast.error('Please log in to vote');
      return;
    }

    if (voteStatus.userHasVoted) {
      toast.error('You have already voted for this device reset');
      return;
    }

    setIsVoting(true);
    try {
      console.log('Submitting vote for device:', deviceId);
      const result = await voteForEnergyReset(deviceId);
      console.log('Vote result:', result);
      
      if (result.error) {
        console.error('Vote error from server:', result.error);
        toast.error(result.error);
        
        // Update local state if server provided vote data
        if (result.votes_received !== undefined) {
          const userHasVoted = result.votes?.some((vote: any) => vote.user_id === user.id) || result.user_has_voted || false;
          setVoteStatus(prev => ({ 
            ...prev, 
            userHasVoted: userHasVoted,
            currentVotes: result.votes_received || prev.currentVotes,
            totalRequired: result.required_votes || prev.totalRequired,
            votes: result.votes || prev.votes
          }));
        }
      } else {
        console.log('Vote successful, updating status');
        toast.success('Vote submitted successfully!');
        
        // Immediately update the local state to reflect the vote
        const newStatus = {
          currentVotes: result.votes_received || 0,
          totalRequired: result.required_votes || voteStatus.totalRequired,
          userHasVoted: true, // Always set to true after successful vote
          votes: result.votes || []
        };
        
        console.log('Setting new vote status after successful vote:', newStatus);
        setVoteStatus(newStatus);
        
        if (result.reset_triggered) {
          toast.success('🎉 Energy reset has been triggered! Hardware will reset energy counters.');
        }
      }
    } catch (error) {
      console.error('Vote error:', error);
      toast.error('Failed to submit vote');
    } finally {
      setIsVoting(false);
    }
  };

  return {
    voteStatus,
    isVoting,
    handleVote,
    loadVoteStatus
  };
};
