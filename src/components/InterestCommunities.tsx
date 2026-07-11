import React, { useState, useEffect, useRef } from 'react';
import { Profile, InterestCommunity, CommunityMessage } from '../types';
import { supabase } from '../lib/supabase';
import { useLocation } from '../contexts/LocationContext';
import LocationIndicator from './LocationIndicator';
import { 
  MessageSquare, Users, ShieldCheck, Send, PhoneCall, Volume2, Mic, 
  MicOff, PhoneOff, Award, Sparkles, MessageCircle, Image, Compass, 
  HelpCircle, MoreVertical, Plus, UserPlus, Heart, ExternalLink 
} from 'lucide-react';

interface InterestCommunitiesProps {
  currentUser: Profile;
  lang: 'ar' | 'en';
  allProfiles?: Profile[];
}

const prebuiltCommunities: InterestCommunity[] = [
  {
    id: 'cars',
    nameAr: 'مجتمع السيارات والرحلات 🚗',
    nameEn: 'Cars & Cruiser Club 🚗',
    descriptionAr: 'عشاق التعديل، الرحلات الطويلة، الجولات الترفيهية ومحبي مشاوير الخطوط الطويلة.',
    descriptionEn: 'Gearheads, styling tuning, scenic highway cruise rides, and car pooling mechanics.',
    icon: '🚗',
    membersCount: 142,
    members: []
  },
  {
    id: 'football',
    nameAr: 'شلة كرة القدم والبطولات ⚽',
    nameEn: 'Football League Hub ⚽',
    descriptionAr: 'تنسيق مباريات ملاعب الحواري، حجز الملاعب، وتشكيل الفرق بانتظام.',
    descriptionEn: 'Friendly neighborhood pitch bookings, tactics, and hosting dynamic local tournaments.',
    icon: '⚽',
    membersCount: 218,
    members: []
  },
  {
    id: 'gaming',
    nameAr: 'فريق الجيمنج ومقاهي الـ PC 🎮',
    nameEn: 'Gaming & Esports Clan 🎮',
    descriptionAr: 'لعشاق شبكات بلايستيشن والـ VR، مقاهي القيمنق والمواجهات الحماسية.',
    descriptionEn: 'Cooperative PC setups, VR lounge visits, and console tournaments challengers.',
    icon: '🎮',
    membersCount: 185,
    members: []
  },
  {
    id: 'photography',
    nameAr: 'نادي مخرجي وتصوير الطلعات 📸',
    nameEn: 'Photography & Aesthetic Clips 📸',
    descriptionAr: 'محبي لقطات الكاميرات الاحترافية والريلز الإبداعية للطلعات ولقطات الطبيعة.',
    descriptionEn: 'Creative camera shots directors, cinematic Reels curation, and cityscape viewpoint hunting.',
    icon: '📸',
    membersCount: 94,
    members: []
  },
  {
    id: 'trips',
    nameAr: 'رابطة رحلات البر والبراري ⛺',
    nameEn: 'Desert Expeditions & Trips ⛺',
    descriptionAr: 'عشاق الشواء تحت النجوم، كشتات الطعوس ولوازم طلعات الويكند في الطبيعة.',
    descriptionEn: 'Fireside camps under the stars, desert dunes riding, and outdoor weekend getaways.',
    icon: '⛺',
    membersCount: 156,
    members: []
  },
  {
    id: 'gourmet',
    nameAr: 'رابطة الذواقة والقهوة المختصة 🍔',
    nameEn: 'Gourmet Food & Specialty Coffee 🍔',
    descriptionAr: 'تجمع محبي تجربة المطاعم الجديدة، البرجر المبتكر، وجلسات تذوق البن الفاخر.',
    descriptionEn: 'Explorers of new diner lines, bespoke smash burgers, and single-origin coffee tastings.',
    icon: '🍔',
    membersCount: 173,
    members: []
  },
  {
    id: 'nightlife',
    nameAr: 'نادي السائرين وتأمل النجوم 🌌',
    nameEn: 'Night Walkers & Star Gazers 🌌',
    descriptionAr: 'عشاق المشي الليلي، تأمل النجوم عند الساعة 2 صباحاً وجلسات السمر الهادئة.',
    descriptionEn: 'Adorers of midnight walks, stargazing picnics at 2 AM, and deep serene evening chats.',
    icon: '🌌',
    membersCount: 112,
    members: []
  },
  {
    id: 'fitness',
    nameAr: 'فريق الفتنس والهايكنج الرياضي 🏃‍♂️',
    nameEn: 'Fitness & Adventure Hiking 🏃‍♂️',
    descriptionAr: 'تحديات اللياقة البدنية، الجري الصباحي، تسلق الجبال ومغامرات الباديل.',
    descriptionEn: 'Morning running streaks, epic mountain climbing, and energetic padel tennis matches.',
    icon: '🏃‍♂️',
    membersCount: 125,
    members: []
  },
  {
    id: 'tech',
    nameAr: 'مجتمع المبرمجين والذكاء الاصطناعي 💻',
    nameEn: 'Developers & AI Innovators 💻',
    descriptionAr: 'نقاشات برمجية، بناء أفكار ريادية، مشاركة كود وتجارب الذكاء الاصطناعي الحديثة.',
    descriptionEn: 'Co-working setup sync, tech entrepreneurship, code reviews, and testing AI systems.',
    icon: '💻',
    membersCount: 148,
    members: []
  }
];

// Helper to map personality archetype to community ID
export function getCommunityIdFromArchetype(archetype: string): string {
  const normalized = (archetype || '').toLowerCase();
  if (normalized.includes('coffee') || normalized.includes('connoisseur') || normalized.includes('قهوة')) return 'gourmet';
  if (normalized.includes('cruiser') || normalized.includes('driver') || normalized.includes('قيادة')) return 'cars';
  if (normalized.includes('athlete') || normalized.includes('active') || normalized.includes('رياضي')) return 'fitness';
  if (normalized.includes('reader') || normalized.includes('quiet') || normalized.includes('هادئ')) return 'tech';
  if (normalized.includes('catalyst') || normalized.includes('social') || normalized.includes('حماسة')) return 'trips';
  if (normalized.includes('gamer') || normalized.includes('hyperactive') || normalized.includes('ألعاب')) return 'gaming';
  return 'gourmet'; // fallback
}

export default function InterestCommunities({ currentUser, lang, allProfiles = [] }: InterestCommunitiesProps) {
  const isAr = lang === 'ar';
  
  const [communities, setCommunities] = useState<InterestCommunity[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<InterestCommunity | null>(null);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Channels logic
  const [activeChannel, setActiveChannel] = useState<'general' | 'plans' | 'media'>('general');

  // Group Voice Call states
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [participantsCount, setParticipantsCount] = useState(4);

  // Auto classification toast/alert trigger state
  const [classificationBanner, setClassificationBanner] = useState<{ show: boolean, text: string }>({ show: false, text: '' });

  // Voice talk simulation speaker states
  const [simulatedSpeakers, setSimulatedSpeakers] = useState<string[]>([]);

  // Load Communities from Supabase and handle auto-classification & missing seeds
  useEffect(() => {
    const fetchAndSyncCommunities = async () => {
      const { data, error } = await supabase.from('communities').select('*');
      
      if (error) {
        console.error("Error fetching communities from Supabase:", error);
        return;
      }

      let loadedList = data || [];

      // Seed any missing prebuilt communities to ensure they exist in Supabase
      const missing = prebuiltCommunities.filter(pc => !loadedList.some(lc => lc.id === pc.id));
      if (missing.length > 0) {
        try {
          const { error: seedErr } = await supabase
            .from('communities')
            .insert(missing.map(c => ({
              id: c.id,
              nameAr: c.nameAr,
              nameEn: c.nameEn,
              descriptionAr: c.descriptionAr,
              descriptionEn: c.descriptionEn,
              icon: c.icon,
              membersCount: c.membersCount,
              members: [currentUser.id],
              created_at: new Date().toISOString()
            })));

          if (!seedErr) {
            const { data: refreshed } = await supabase.from('communities').select('*');
            if (refreshed) loadedList = refreshed;
          }
        } catch (e) {
          console.error("Failed to seed missing communities:", e);
        }
      }

      setCommunities(loadedList);

      // Auto-classify user based on their quiz archetype
      const matchedCommunityId = getCommunityIdFromArchetype(currentUser.archetype || '');
      const matchedComm = loadedList.find(c => c.id === matchedCommunityId);

      // Select community. If user belongs to one, select that one first, otherwise fallback to first
      if (!selectedCommunity) {
        if (matchedComm) {
          setSelectedCommunity(matchedComm);
        } else if (loadedList.length > 0) {
          setSelectedCommunity(loadedList[0]);
        }
      }

      // If user is not yet marked as a member of their matching community, auto-join them in Supabase!
      if (matchedComm && (!matchedComm.members || !matchedComm.members.includes(currentUser.id))) {
        try {
          const updatedMembers = [...(matchedComm.members || []), currentUser.id];
          const { error: updateErr } = await supabase
            .from('communities')
            .update({
              members: updatedMembers,
              membersCount: updatedMembers.length
            })
            .eq('id', matchedCommunityId);

          if (!updateErr) {
            setClassificationBanner({
              show: true,
              text: isAr 
                ? `🎯 بناءً على نتيجة اختبارك الشخصي (${currentUser.archetype || 'ذوّاق القهوة'})، تم تصنيفك وتوجيهك تلقائياً كعضو رسمي بمجتمع: ${matchedComm.nameAr}!`
                : `🎯 Based on your quiz results (${currentUser.archetype || 'The Coffee Connoisseur'}), you have been automatically classified as an active member of: ${matchedComm.nameEn}!`
            });
            
            // Local update
            setCommunities(prev => prev.map(c => c.id === matchedCommunityId ? { ...c, members: updatedMembers, membersCount: updatedMembers.length } : c));
          }
        } catch (e) {
          console.error("Failed to auto-join classified community:", e);
        }
      }
    };

    fetchAndSyncCommunities();
  }, [currentUser, selectedCommunity]);

  // Load separate persistent messages based on selected community AND active sub-channel
  useEffect(() => {
    if (!selectedCommunity) return;

    const fetchMessages = async () => {
      // General channel uses default community ID, sub-rooms use composite keys
      const dbCommunityId = activeChannel === 'general' 
        ? selectedCommunity.id 
        : `${selectedCommunity.id}_${activeChannel}`;

      const { data, error } = await supabase
        .from('community_messages')
        .select('*')
        .eq('communityId', dbCommunityId)
        .order('timestamp', { ascending: true })
        .limit(100);

      if (error) {
        console.error("Error fetching messages for channel:", error);
        return;
      }
      setMessages(data || []);
    };

    fetchMessages();
  }, [selectedCommunity, activeChannel]);

  // Scroll to bottom on message load/change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Group Voice Call simulation speakers timing
  useEffect(() => {
    if (isVoiceActive) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      // Simulate speakers list using other real profiles to make it feel bustling
      const possibleSpeakers = allProfiles
        .filter(p => p.id !== currentUser.id)
        .map(p => p.name || 'YallaMate Partner');
      
      const speakersInterval = setInterval(() => {
        const randomSpeakers: string[] = [];
        const speakingCount = Math.floor(Math.random() * 2) + 1; // 1 or 2 speakers
        for (let i = 0; i < speakingCount; i++) {
          if (possibleSpeakers.length > 0) {
            const randomIndex = Math.floor(Math.random() * possibleSpeakers.length);
            randomSpeakers.push(possibleSpeakers[randomIndex]);
          }
        }
        setSimulatedSpeakers(randomSpeakers);
      }, 4000);

      const countInterval = setInterval(() => {
        setParticipantsCount(prev => Math.max(2, Math.min(8, prev + (Math.random() > 0.5 ? 1 : -1))));
      }, 8000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        clearInterval(speakersInterval);
        clearInterval(countInterval);
      };
    } else {
      setCallDuration(0);
      setSimulatedSpeakers([]);
    }
  }, [isVoiceActive, allProfiles, currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const dbCommunityId = activeChannel === 'general' 
      ? selectedCommunity!.id 
      : `${selectedCommunity!.id}_${activeChannel}`;

    const newMsg: Partial<CommunityMessage> = {
      communityId: dbCommunityId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderScore: currentUser.trustScore,
      isVerified: currentUser.verified,
      content: inputText,
      timestamp: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('community_messages').insert([newMsg]);
      if (error) throw error;
      setInputText('');
    } catch (err) {
      console.error('Failed to post community message to Supabase', err);
      // Fallback state push
      const immediateMsg: CommunityMessage = {
        id: `local_${Date.now()}`,
        ...(newMsg as Omit<CommunityMessage, 'id'>)
      };
      setMessages(prev => [...prev, immediateMsg]);
      setInputText('');
    }
  };

  const handleToggleJoin = async () => {
    if (!selectedCommunity) return;
    try {
      const isMember = selectedCommunity.members?.includes(currentUser.id);
      
      const newMembers = isMember
        ? (selectedCommunity.members || []).filter(id => id !== currentUser.id)
        : [...(selectedCommunity.members || []), currentUser.id];

      const { error } = await supabase
        .from('communities')
        .update({
          members: newMembers,
          membersCount: newMembers.length
        })
        .eq('id', selectedCommunity.id);
      
      if (error) throw error;

      // Update local state
      setCommunities(prev => prev.map(c => c.id === selectedCommunity.id ? { ...c, members: newMembers, membersCount: newMembers.length } : c));
      setSelectedCommunity(prev => prev ? { ...prev, members: newMembers, membersCount: newMembers.length } : null);
    } catch (e) {
      console.error('Failed to toggle join', e);
    }
  };

  const toggleCall = () => {
    setIsVoiceActive(!isVoiceActive);
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Filter actual members of this group from real loaded profiles
  const activeGroupMembers = allProfiles.filter(p => {
    // If they have matched archetype or explicitly joined
    const belongs = getCommunityIdFromArchetype(p.archetype || '') === selectedCommunity?.id;
    return belongs || (selectedCommunity?.members && selectedCommunity.members.includes(p.id));
  });

  if (!selectedCommunity || communities.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Sparkles className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Classification Banner Notification */}
      {classificationBanner.show && (
        <div className="bg-gradient-to-r from-indigo-600/30 via-indigo-500/10 to-transparent border border-indigo-500/20 rounded-[2rem] p-5 flex items-center justify-between gap-4 shadow-lg shadow-indigo-500/5 animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-4">
            <span className="text-3xl animate-bounce">🎯</span>
            <div>
              <p className="text-xs font-black text-white">{isAr ? 'تصنيف ذكي فوري' : 'Instant Smart Classification'}</p>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-1">{classificationBanner.text}</p>
            </div>
          </div>
          <button 
            onClick={() => setClassificationBanner({ show: false, text: '' })}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] text-slate-400 hover:text-white transition cursor-pointer"
          >
            {isAr ? 'حسناً' : 'Okay'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar: Communities Selection List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#111622] border border-white/10 rounded-[2.5rem] p-5 shadow-[0_4px_30px_rgba(0,0,0,0.5)] space-y-4">
            <div>
              <h4 className="text-md font-display font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400 animate-pulse" />
                {isAr ? 'مجتمعات ومجموعات الاهتمام 🌍' : 'Interest Communities & Groups'}
              </h4>
              <p className="text-[10px] text-slate-400 mt-1 mb-2">
                {isAr ? 'انضم إلى رفقاء يشاركونك نفس الهواية والشغف الحقيقي!' : 'Coordinate trips with companions matching your lifestyle!'}
              </p>
              <LocationIndicator lang={lang} className="!ml-0 !mr-0 !bg-white/5 !text-white !border-white/10 !justify-start scale-90 origin-left" />
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {communities.map((comm) => {
                const isSelected = comm.id === selectedCommunity.id;
                const isUserClassified = getCommunityIdFromArchetype(currentUser.archetype || '') === comm.id;
                
                return (
                  <button
                    key={comm.id}
                    onClick={() => {
                      setSelectedCommunity(comm);
                      setActiveChannel('general');
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border-indigo-500 text-white shadow-lg'
                        : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 bg-[#0B0E14] border border-white/10 rounded-xl flex items-center justify-center text-xl select-none">
                        {comm.icon}
                      </span>
                      <div className="text-right flex-1">
                        <span className="text-xs font-black block leading-none mb-1 text-white flex items-center gap-1.5">
                          {isAr ? comm.nameAr : comm.nameEn}
                          {isUserClassified && (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[8px] font-black px-1.5 py-0.5 rounded-full select-none shrink-0 scale-90">
                              {isAr ? 'مجتمعك' : 'Yours'}
                            </span>
                          )}
                        </span>
                        <span className="text-[9px] text-slate-400 font-semibold max-w-[210px] truncate block">
                          {isAr ? comm.descriptionAr : comm.descriptionEn}
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] bg-[#0B0E14] border border-white/10 px-2 py-0.5 rounded-full font-mono text-indigo-300 shrink-0 scale-90">
                      {comm.membersCount} {isAr ? 'عضو' : 'mbrs'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group Voice Call Widget */}
          <div className="bg-gradient-to-br from-indigo-950/40 to-[#0e1628]/40 backdrop-blur-md rounded-[2rem] p-5 border border-indigo-500/20 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhoneCall className={`w-5 h-5 ${isVoiceActive ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                <div>
                  <h5 className="text-xs font-black text-white">{isAr ? 'المجلس الصوتي للمجتمع 🎙️' : 'Lively Community Lounge'}</h5>
                  <p className="text-[9px] text-slate-400">{isAr ? 'تحدث مباشرة بصوت عالي الجودة مع رفقائك' : 'Voice chat live with your group'}</p>
                </div>
              </div>
              {isVoiceActive && (
                <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <Volume2 className="w-3.5 h-3.5" />
                  {formatDuration(callDuration)}
                </span>
              )}
            </div>

            {isVoiceActive ? (
              <div className="space-y-3.5 bg-black/20 p-3.5 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">{isAr ? 'حالة البث: نشط 🟢' : 'Live Status: Connected 🟢'}</span>
                  <span className="text-indigo-400 font-black">{participantsCount} {isAr ? 'بالغرفة' : 'Connected'}</span>
                </div>

                {/* Simulated speakers with voice talk waves */}
                <div className="space-y-2">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold">{isAr ? 'الذين يتحدثون الآن:' : 'Speaking Now:'}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-2 flex items-center gap-2 animate-pulse">
                      <span className="text-xs">🔊</span>
                      <span className="text-[10px] text-white font-bold truncate flex-1">{currentUser.name} ({isAr ? 'أنت' : 'You'})</span>
                    </div>
                    {simulatedSpeakers.map((speaker, idx) => (
                      <div key={idx} className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2 flex items-center gap-2">
                        <span className="text-xs animate-bounce">🎙️</span>
                        <span className="text-[10px] text-slate-200 font-bold truncate flex-1">{speaker}</span>
                      </div>
                    ))}
                    {simulatedSpeakers.length === 0 && (
                      <div className="bg-white/5 border border-white/5 rounded-xl p-2 flex items-center justify-center text-[9px] text-slate-500 col-span-2">
                        {isAr ? 'تحدث في المايك لبدء بث موجاتك...' : 'Speak into your mic to trigger stream...'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer text-[10px] font-bold ${
                      isMuted 
                        ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' 
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {isMuted ? (isAr ? 'تحدث' : 'Unmute') : (isAr ? 'كتم' : 'Mute')}
                  </button>

                  <button
                    onClick={toggleCall}
                    className="py-2 px-3 bg-rose-600 hover:bg-rose-500 border border-rose-500/20 text-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-[10px] font-black col-span-2"
                  >
                    <PhoneOff className="w-4 h-4" />
                    {isAr ? 'مغادرة الغرفة' : 'Leave Lounge'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={toggleCall}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-indigo-400/20"
              >
                <PhoneCall className="w-4 h-4 animate-bounce" />
                {isAr ? 'الانضمام لمجلس الصوت الجماعي 🎧' : 'Join Voice CallRoom 🎧'}
              </button>
            )}
          </div>
        </div>

        {/* Main Block: Thread Chat & Members Grid */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-12 gap-4 h-[560px]">
          {/* Left/Middle Column: Chat Screen with persistent Sub-channels */}
          <div className="md:col-span-8 flex flex-col h-full bg-[#111622] border border-white/10 rounded-[2rem] shadow-xl overflow-hidden">
            {/* Chat header */}
            <header className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-2xl bg-white/5 p-1.5 rounded-xl border border-white/5 select-none">{selectedCommunity.icon}</span>
                <div className="text-right">
                  <h5 className="text-xs font-black text-white">{isAr ? selectedCommunity.nameAr : selectedCommunity.nameEn}</h5>
                  <span className="text-[9px] text-indigo-400 font-bold">{isAr ? 'قناة تفاعلية رسمية موثقة' : 'Official Verified Interest Group'}</span>
                </div>
              </div>
              <button 
                onClick={handleToggleJoin}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-black transition-all cursor-pointer ${
                  selectedCommunity.members?.includes(currentUser.id)
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                }`}
              >
                {selectedCommunity.members?.includes(currentUser.id)
                  ? (isAr ? 'عضو منضم ✓' : 'Joined ✓')
                  : (isAr ? 'انضمام للمجموعة +' : 'Join +')}
              </button>
            </header>

            {/* Interactive persistent Sub-Channels Toggles */}
            <div className="flex border-b border-white/10 bg-[#0B0E14] p-1.5 gap-1">
              <button
                onClick={() => setActiveChannel('general')}
                className={`flex-1 py-1.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  activeChannel === 'general'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {isAr ? 'الدردشة العامة' : 'General Chat'}
              </button>

              <button
                onClick={() => setActiveChannel('plans')}
                className={`flex-1 py-1.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  activeChannel === 'plans'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                {isAr ? 'تنسيق الطلعات' : 'Trip Plans'}
              </button>

              <button
                onClick={() => setActiveChannel('media')}
                className={`flex-1 py-1.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  activeChannel === 'media'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Image className="w-3.5 h-3.5" />
                {isAr ? 'الصور والميديا' : 'Photos Share'}
              </button>
            </div>

            {/* Channels Messages History area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0B0E14]/30">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <span className="text-3xl">💬</span>
                  <div>
                    <p className="text-xs font-black text-white">
                      {isAr 
                        ? `مرحباً بك في غرفة ${activeChannel === 'general' ? 'الدردشة العامة' : activeChannel === 'plans' ? 'تنسيق الرحلات والبرامج' : 'مشاركة الصور واللقطات'}!` 
                        : `Welcome to ${activeChannel === 'general' ? 'General' : activeChannel === 'plans' ? 'Trip Plans' : 'Media Gallery'}!`
                      }
                    </p>
                    <p className="text-[10px] text-slate-500 max-w-xs mt-1">
                      {isAr 
                        ? 'تواصل مع رفقائك وتفاعل مع مشاركاتهم الحقيقية في هذا المجتمع الموثق.' 
                        : 'Engage and interact with verified companions within this group.'
                      }
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.senderId === currentUser.id;
                  return (
                    <div key={msg.id || index} className={`flex gap-3 items-start max-w-[85%] ${isMe ? (isAr ? 'mr-auto flex-row-reverse' : 'ml-auto flex-row-reverse') : ''}`}>
                      <span className="w-9 h-9 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-lg shadow-sm shrink-0 select-none">
                        {msg.senderAvatar || '👽'}
                      </span>

                      <div className="space-y-1">
                        <div className={`flex items-center gap-1.5 text-[9px] font-extrabold ${isMe ? 'justify-end' : ''}`}>
                          <span className="text-white">{msg.senderName}</span>
                          {msg.isVerified && <ShieldCheck className="w-3 h-3 text-indigo-400 fill-indigo-400/20 shrink-0" />}
                          {msg.senderScore && (
                            <span className="text-amber-400 text-[8px] font-black flex items-center shrink-0">
                              ★{msg.senderScore.toFixed(1)}
                            </span>
                          )}
                        </div>

                        <div className={`p-3 rounded-2xl text-[11px] relative ${
                          isMe 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : 'bg-white/5 text-slate-100 rounded-tl-none border border-white/5'
                        }`}>
                          <p className="leading-relaxed break-words">{msg.content}</p>
                          <span className="text-[8px] opacity-60 block mt-1 text-right font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <form onSubmit={handleSendMessage} className="p-3 bg-[#0B0E14] border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isAr 
                    ? `اكتب مشاركتك في قناة #${activeChannel === 'general' ? 'الدردشة العامة' : activeChannel === 'plans' ? 'تنسيق الرحلات' : 'الصور والميديا'}...` 
                    : `Speak out to channel #${activeChannel}...`
                }
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="submit"
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Right Column: Real Group Members sidebar list */}
          <div className="md:col-span-4 hidden md:flex flex-col h-full bg-[#111622] border border-white/10 rounded-[2rem] p-4 shadow-xl space-y-4">
            <div>
              <h6 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{isAr ? 'الأعضاء المتواجدون 🟢' : 'Active Members 🟢'}</h6>
              <p className="text-[9px] text-slate-400 mt-0.5">{isAr ? 'الرفقاء المنتمون لهذا التصنيف' : 'Real fellows matching this vibe'}</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {/* Show actual current user first */}
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-7 h-7 bg-indigo-600/20 rounded-lg flex items-center justify-center text-xs select-none shrink-0">{currentUser.avatar}</span>
                  <div className="truncate text-right">
                    <span className="text-[10px] font-black text-white block truncate leading-tight">{currentUser.name}</span>
                    <span className="text-[8px] text-indigo-300 font-extrabold">{isAr ? 'أنت (نشط)' : 'You (Active)'}</span>
                  </div>
                </div>
                {currentUser.verified && <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
              </div>

              {/* Load actual profiles belonging to this community */}
              {activeGroupMembers.filter(m => m.id !== currentUser.id).map((member, idx) => (
                <div key={idx} className="p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl flex items-center justify-between transition-all">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-xs select-none shrink-0">{member.avatar || '👤'}</span>
                    <div className="truncate text-right">
                      <span className="text-[10px] font-bold text-white block truncate leading-tight">{member.name}</span>
                      <span className="text-[8px] text-slate-400 font-mono">{member.location || (isAr ? 'الرياض' : 'Riyadh')}</span>
                    </div>
                  </div>
                  {member.verified && <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                </div>
              ))}

              {/* Seed placeholder active virtual users if there are few members */}
              {activeGroupMembers.length < 5 && (
                <>
                  <p className="text-[8px] text-slate-600 uppercase tracking-wider font-extrabold pt-2">{isAr ? 'رفقاء مقترحون للمجتمع:' : 'Recommended companions:'}</p>
                  {[
                    { name: 'أحمد العتيبي', avatar: '🚗', place: 'الرياض' },
                    { name: 'سارة خالد', avatar: '📸', place: 'جدة' },
                    { name: 'محمد فهد', avatar: '⛺', place: 'الدمام' },
                    { name: 'ريناد صالح', avatar: '🍔', place: 'الخبر' }
                  ].map((rec, idx) => (
                    <div key={idx} className="p-2 bg-[#0B0E14] border border-white/5 rounded-xl flex items-center justify-between opacity-85">
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center text-xs select-none shrink-0">{rec.avatar}</span>
                        <div className="truncate text-right">
                          <span className="text-[10px] font-bold text-slate-300 block truncate leading-none mb-0.5">{rec.name}</span>
                          <span className="text-[8px] text-indigo-400 font-extrabold">{isAr ? rec.place : 'Nearby'}</span>
                        </div>
                      </div>
                      <button className="p-1 bg-white/5 hover:bg-indigo-600 rounded-lg text-slate-400 hover:text-white transition">
                        <UserPlus className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
