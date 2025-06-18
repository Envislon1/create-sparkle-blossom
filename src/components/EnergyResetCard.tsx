
import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEnergyResetVoting } from '@/hooks/useEnergyResetVoting';

interface EnergyResetCardProps {
  deviceId: string;
  deviceName: string;
}

const EnergyResetCard: React.FC<EnergyResetCardProps> = ({ deviceId, deviceName }) => {
  const { user } = useAuth();
  const { voteStatus, isVoting, handleVote, loadVoteStatus } = useEnergyResetVoting(deviceId);

  const getUserDisplayName = (vote: any) => {
    // Check for profile full name first
    if (vote.profiles?.full_name) {
      return vote.profiles.full_name;
    }
    
    // Fallback to user ID truncated
    if (vote.user_id) {
      return `User ${vote.user_id.slice(0, 8)}...`;
    }
    
    return 'Unknown User';
  };

  const formatVoteTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (error) {
      return 'Unknown time';
    }
  };

  // Set up periodic refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadVoteStatus, 10000);
    return () => clearInterval(interval);
  }, [loadVoteStatus]);

  // Refresh vote status when the component becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadVoteStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadVoteStatus]);

  console.log('Vote status in card:', voteStatus);

  return (
    <Card className="energy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-energy-600 dark:text-energy-400" />
          Energy Reset - {deviceName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">Voting Progress</span>
            </div>
            <span className="text-sm font-bold">
              {voteStatus.currentVotes}/{voteStatus.totalRequired}
            </span>
          </div>

          {voteStatus.votes && voteStatus.votes.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Users who have voted ({voteStatus.votes.length}):</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {voteStatus.votes.map((vote: any, index: number) => {
                  const displayName = getUserDisplayName(vote);
                  const isCurrentUser = vote.user_id === user?.id;
                  const voteTime = formatVoteTime(vote.voted_at || vote.created_at);
                  
                  return (
                    <div key={vote.id || `vote-${index}`} className={`flex items-center justify-between text-sm p-3 rounded-lg border ${isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <div className="flex flex-col">
                          <span className={`font-medium ${isCurrentUser ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                            {displayName} {isCurrentUser ? '(You)' : ''}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {voteTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!voteStatus.userHasVoted ? (
            <Button 
              onClick={handleVote}
              disabled={isVoting}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVoting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Submitting Vote...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Vote to Reset Energy Counters
                </>
              )}
            </Button>
          ) : (
            <Button 
              disabled
              className="flex-1 bg-green-500 text-white cursor-not-allowed opacity-70"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Vote Submitted
            </Button>
          )}
        </div>

        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-medium">How voting works:</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li>• All users with channels on this device must vote to reset energy counters</li>
                <li>• Total required votes: {voteStatus.totalRequired} (based on device channels)</li>
                <li>• Once all votes are collected, hardware will reset energy counters</li>
                <li>• Each user can only vote once per reset session</li>
                <li>• Voting sessions expire after 24 hours</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnergyResetCard;
