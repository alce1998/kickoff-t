import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Check, X, UserMinus } from "lucide-react";
import { NavigationBar } from "@/components/NavigationBar";
import { toast } from "sonner";

export default function Amici() {
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useTranslation();

  // Queries
  const { data: friends = [], refetch: refetchFriends } = trpc.friends.getFriends.useQuery();
  const { data: pendingRequests = [], refetch: refetchRequests } = trpc.friends.getPendingRequests.useQuery();
  const { data: searchResults = [], refetch: searchUsers } = trpc.friends.searchUsers.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 0 }
  );

  // Mutations
  const sendRequest = trpc.friends.sendFriendRequest.useMutation({
    onSuccess: () => {
      toast.success(t('amici.richiestainviata'));
      setSearchQuery("");
    },
    onError: (error: any) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const acceptRequest = trpc.friends.acceptFriendRequest.useMutation({
    onSuccess: () => {
      toast.success(t('amici.amiciziaAccettata'));
      refetchRequests();
      refetchFriends();
    },
    onError: (error: any) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const rejectRequest = trpc.friends.rejectFriendRequest.useMutation({
    onSuccess: () => {
      toast.success(t('amici.richiestaRifiutata'));
      refetchRequests();
    },
    onError: (error: any) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const removeFriend = trpc.friends.removeFriend.useMutation({
    onSuccess: () => {
      toast.success(t('amici.amicoRimosso'));
      refetchFriends();
    },
    onError: (error: any) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim().length > 0) {
      searchUsers();
    }
  };

  const handleRemoveFriend = (friendId: number, friendName: string | null) => {
    if (confirm(t('amici.confermaRimozione', { name: friendName || t('amici.questoAmico') }))) {
      removeFriend.mutate({ friendId });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <NavigationBar onFeedbackClick={() => {}} />

      <div className="container py-8 pt-24">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-display font-bold uppercase tracking-tighter text-primary mb-2">
            {t('amici.titolo')}
          </h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">
            {t('amici.sottotitolo')}
          </p>
        </header>

        {/* Search Section */}
        <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-8">
          <h2 className="text-2xl font-display font-bold uppercase mb-4">{t('amici.cercaAmici')}</h2>
          <div className="flex gap-2">
            <Input
              placeholder={t('amici.cercaPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold"
            />
            <Button 
              onClick={handleSearch} 
              className="bg-black hover:bg-gray-800 text-white font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <Search className="w-4 h-4 mr-2" />
              {t('amici.cerca')}
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="font-bold uppercase text-sm text-muted-foreground">{t('amici.risultati')}:</h3>
              {searchResults.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center justify-between p-4 border-2 border-black bg-background shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div>
                    <p className="font-bold text-lg">{user.username ? `@${user.username}` : user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => sendRequest.mutate({ receiverId: user.id })}
                    disabled={sendRequest.isPending}
                    className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {t('amici.aggiungi')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-8">
            <h2 className="text-2xl font-display font-bold uppercase mb-4">{t('amici.richiesteAmicizia')}</h2>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="flex items-center justify-between p-4 border-2 border-black bg-background shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div>
                    <p className="font-bold text-lg">{request.sender?.username ? `@${request.sender.username}` : request.sender?.name}</p>
                    <p className="text-sm text-muted-foreground">{request.sender?.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => acceptRequest.mutate({ requestId: request.id })}
                      disabled={acceptRequest.isPending}
                      className="bg-green-500 hover:bg-green-600 text-white font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      {t('amici.accetta')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectRequest.mutate({ requestId: request.id })}
                      disabled={rejectRequest.isPending}
                      className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold"
                    >
                      <X className="w-4 h-4 mr-2" />
                      {t('amici.rifiuta')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List */}
        <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
          <h2 className="text-2xl font-display font-bold uppercase mb-4">
            {t('amici.amici')} ({friends.length})
          </h2>
          {friends.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground font-bold uppercase text-sm">
                {t('amici.nessunoAmico')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {friends.map((friend) => (
                <div 
                  key={friend.id} 
                  className="p-4 border-2 border-black bg-background shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-lg">{friend.username ? `@${friend.username}` : friend.name}</p>
                    <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded-full text-xs font-bold">
                      ⭐ {friend.eloRating || 1200}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{friend.email}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemoveFriend(friend.id, friend.username ? `@${friend.username}` : friend.name)}
                    disabled={removeFriend.isPending}
                    className="w-full border-2 border-black bg-red-50 hover:bg-red-100 text-red-600 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <UserMinus className="w-4 h-4 mr-2" />
                    {t('amici.rimuovi')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
