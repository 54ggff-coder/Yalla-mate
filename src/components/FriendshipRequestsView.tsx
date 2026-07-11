import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FriendshipManager } from '../services/friendshipManager';
import { Profile } from '../types';
import { Language, translations } from '../data/translations';
import { renderAvatar } from './MatesReels';

interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted';
  senderName: string;
  senderAvatar: string;
}

interface FriendshipRequestsViewProps {
  currentUser: Profile;
  lang: Language;
}

export default function FriendshipRequestsView({ currentUser, lang }: FriendshipRequestsViewProps) {
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const isAr = lang === 'ar';

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('receiverId', currentUser.id)
      .eq('status', 'pending');
    
    if (data) {
      setPendingRequests(data);
    }
  };

  useEffect(() => {
    fetchRequests();
    
    const channel = supabase
      .channel('friend_requests_new_view')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'friend_requests',
        filter: `receiverId=eq.${currentUser.id}`
      }, () => fetchRequests())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser.id]);

  const handleAccept = async (request: FriendRequest) => {
    const result = await FriendshipManager.acceptRequest(request.id, request.senderId, currentUser.id);
    if (result.success) {
      setPendingRequests(prev => prev.filter(r => r.id !== request.id));
    }
  };

  const handleDecline = async (requestId: string) => {
    const result = await FriendshipManager.rejectRequest(requestId);
    if (result.success) {
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    }
  };

  if (pendingRequests.length === 0) return null;

  return (
    <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-3">
      <span className="text-[10px] font-black text-indigo-800 tracking-wider block uppercase">
        👉 {isAr ? 'طلبات الصداقة بانتظارك' : 'BUDDIES WAITING FOR YOU'} ({pendingRequests.length})
      </span>
      <div className="space-y-2">
        {pendingRequests.map(req => (
          <div key={req.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-indigo-100 shadow-xs">
            <div className="flex items-center gap-3">
              {renderAvatar(req.senderAvatar, "w-10 h-10 rounded-full")}
              <span className="text-sm font-black text-slate-800">{req.senderName}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAccept(req)}
                className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-xs"
              >
                {isAr ? 'قبول' : 'Accept'}
              </button>
              <button
                onClick={() => handleDecline(req.id)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-xs font-semibold cursor-pointer transition"
              >
                {isAr ? 'رفض' : 'Decline'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
