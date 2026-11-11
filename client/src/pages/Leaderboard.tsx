import { useState } from 'react';
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Leaderboard() {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'friends'>('global');
  const { user } = useAuth();
  
  const { data: globalData, isLoading: globalLoading } = trpc.rankings.getGlobalLeaderboard.useQuery(
    undefined,
    { enabled: !!user && activeTab === 'global' }
  );
  
  const { data: friendsData, isLoading: friendsLoading } = trpc.rankings.getFriendsLeaderboard.useQuery(
    undefined,
    { enabled: !!user && activeTab === 'friends' }
  );
  
  const isLoading = activeTab === 'global' ? globalLoading : friendsLoading;
  
  const renderRankingTable = () => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Caricamento classifica...</p>
        </div>
      );
    }
    
    if (activeTab === 'global' && globalData) {
      const { topUsers, currentUser } = globalData;
      const isUserInTop30 = currentUser && currentUser.rank <= 30;
      
      return (
        <div className="space-y-6">
          {/* Top 30 */}
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-4 border-black bg-pink-100">
                    <th className="p-4 text-left font-bold uppercase">Pos</th>
                    <th className="p-4 text-left font-bold uppercase">Giocatore</th>
                    <th className="p-4 text-right font-bold uppercase">ELO</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.map((entry) => {
                    const isCurrentUser = user && entry.id === user.id;
                    return (
                      <tr 
                        key={entry.id} 
                        className={`border-b-2 border-black ${
                          isCurrentUser ? 'bg-yellow-100 font-bold' : 'hover:bg-pink-50'
                        }`}
                      >
                        <td className="p-4">
                          {entry.rank === 1 && '🥇'}
                          {entry.rank === 2 && '🥈'}
                          {entry.rank === 3 && '🥉'}
                          {entry.rank > 3 && entry.rank}
                        </td>
                        <td className="p-4">{entry.name || 'Anonimo'}</td>
                        <td className="p-4 text-right font-mono">{entry.eloRating}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* User position if not in top 30 */}
          {currentUser && !isUserInTop30 && (
            <div className="bg-yellow-100 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
              <h3 className="font-bold uppercase mb-4 text-center">La tua posizione</h3>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold">#{currentUser.rank}</span>
                  <span className="font-bold">{currentUser.name || 'Tu'}</span>
                </div>
                <span className="text-2xl font-mono font-bold">{currentUser.eloRating}</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    if (activeTab === 'friends' && friendsData) {
      const { friendsRanking } = friendsData;
      
      if (friendsRanking.length === 1) {
        return (
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-bold mb-2">Nessun amico ancora</p>
            <p className="text-muted-foreground">Aggiungi amici per vedere la classifica!</p>
          </div>
        );
      }
      
      return (
        <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-4 border-black bg-pink-100">
                  <th className="p-4 text-left font-bold uppercase">Pos</th>
                  <th className="p-4 text-left font-bold uppercase">Giocatore</th>
                  <th className="p-4 text-right font-bold uppercase">ELO</th>
                </tr>
              </thead>
              <tbody>
                {friendsRanking.map((entry) => {
                  const isCurrentUser = user && entry.id === user.id;
                  return (
                    <tr 
                      key={entry.id} 
                      className={`border-b-2 border-black ${
                        isCurrentUser ? 'bg-yellow-100 font-bold' : 'hover:bg-pink-50'
                      }`}
                    >
                      <td className="p-4">
                        {entry.rank === 1 && '🥇'}
                        {entry.rank === 2 && '🥈'}
                        {entry.rank === 3 && '🥉'}
                        {entry.rank > 3 && entry.rank}
                      </td>
                      <td className="p-4">{entry.name || 'Anonimo'}</td>
                      <td className="p-4 text-right font-mono">{entry.eloRating}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      
      <div className="min-h-screen bg-background text-foreground pt-20 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Trophy className="h-16 w-16 mx-auto mb-4 text-pink-600" />
            <h1 className="text-4xl md:text-5xl font-display font-bold uppercase mb-2">
              Classifiche
            </h1>
            <p className="text-muted-foreground">
              Confronta il tuo punteggio ELO con gli altri giocatori
            </p>
          </div>
          
          {/* Tabs */}
          <div className="flex justify-center gap-4 mb-8">
            <Button
              onClick={() => setActiveTab('global')}
              size="lg"
              className={`py-4 px-8 text-lg font-display font-bold uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${
                activeTab === 'global'
                  ? 'bg-pink-500 text-white hover:bg-pink-600'
                  : 'bg-white text-black hover:bg-gray-100'
              }`}
            >
              <Trophy className="mr-2 h-5 w-5" />
              Globale
            </Button>
            <Button
              onClick={() => setActiveTab('friends')}
              size="lg"
              className={`py-4 px-8 text-lg font-display font-bold uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${
                activeTab === 'friends'
                  ? 'bg-pink-500 text-white hover:bg-pink-600'
                  : 'bg-white text-black hover:bg-gray-100'
              }`}
            >
              <Users className="mr-2 h-5 w-5" />
              Amici
            </Button>
          </div>
          
          {/* Ranking Table */}
          {renderRankingTable()}
        </div>
      </div>
    </>
  );
}
