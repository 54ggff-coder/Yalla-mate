import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, X, CheckCircle, Home, User, Clock, Heart } from 'lucide-react';
import { Profile } from '../types';
import { translations, Language } from '../data/translations';

interface OutingReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    revieweeId: string,
    respectful: number,
    punctual: number,
    payment: number,
    comment: string,
    venueRating: number,
    hostRating: number,
    friendlyRating: number
  ) => void;
  attendeesList: Profile[];
  currentUserId: string;
  lang: Language;
  submittedReviews: string[];
}

export default function OutingReviewModal({
  isOpen,
  onClose,
  onSubmit,
  attendeesList,
  currentUserId,
  lang,
  submittedReviews
}: OutingReviewModalProps) {
  const t = translations[lang];

  const [selectedRevieweeId, setSelectedRevieweeId] = useState('');
  const [respectful, setRespectful] = useState(5);
  const [punctual, setPunctual] = useState(5);
  const [payment, setPayment] = useState(5);
  const [venueRating, setVenueRating] = useState(5);
  const [hostRating, setHostRating] = useState(5);
  const [friendlyRating, setFriendlyRating] = useState(5);
  const [comment, setComment] = useState('');
  const [showRatingSuccess, setShowRatingSuccess] = useState(false);

  const handleSubmit = () => {
    if (!selectedRevieweeId) return;
    setShowRatingSuccess(true);
    onSubmit(
      selectedRevieweeId,
      respectful,
      punctual,
      payment,
      comment,
      venueRating,
      hostRating,
      friendlyRating
    );
    
    setTimeout(() => {
      setShowRatingSuccess(false);
      setSelectedRevieweeId('');
      setRespectful(5);
      setPunctual(5);
      setPayment(5);
      setVenueRating(5);
      setHostRating(5);
      setFriendlyRating(5);
      setComment('');
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  // Star selector helper component
  const StarSelector = ({ 
    value, 
    onChange, 
    label, 
    icon: Icon 
  }: { 
    value: number, 
    onChange: (val: number) => void, 
    label: string, 
    icon: React.ComponentType<{ className?: string }> 
  }) => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex gap-1.5 bg-white/5 p-2 rounded-xl border border-white/5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-0.5 hover:scale-110 transition-transform focus:outline-none cursor-pointer"
          >
            <Star
              className={`w-5 h-5 transition-colors ${
                star <= value ? 'fill-indigo-500 text-indigo-400' : 'text-slate-600'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#0B0E14] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
            <h3 className="text-sm font-black text-indigo-400 flex items-center gap-2 tracking-wide uppercase">
              <Star className="w-4 h-4 fill-indigo-500 text-indigo-400" /> 
              {lang === 'ar' ? 'تقييم تجربة الطلعة والرفاق' : 'Rate Outing Experience'}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* Companion Select */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">
                {t.chooseCompanionToRateLabel || 'Choose Companion'}
              </label>
              <select
                id="select_reviewee"
                value={selectedRevieweeId}
                onChange={(e) => setSelectedRevieweeId(e.target.value)}
                className="w-full text-xs p-3 bg-white/5 border border-white/10 text-slate-200 rounded-xl font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="" className="bg-[#0B0E14]">{t.chooseAttendeeLabel || 'Select someone'}</option>
                {attendeesList
                  .filter(a => a.id !== currentUserId)
                  .map(att => (
                    <option key={att.id} value={att.id} className="bg-[#0B0E14]">
                      {att.avatar || '👤'} {att.name} {submittedReviews.includes(att.id) ? '✓' : ''}
                    </option>
                  ))
                }
              </select>
            </div>

            {selectedRevieweeId && !submittedReviews.includes(selectedRevieweeId) && !showRatingSuccess && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                {/* 4 Core Ratings: Venue, Host, Punctuality, Friendliness */}
                <div className="grid grid-cols-1 gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                  <StarSelector
                    value={venueRating}
                    onChange={setVenueRating}
                    label={lang === 'ar' ? 'تقييم الموقع / المكان' : 'Venue & Gathering Point'}
                    icon={Home}
                  />

                  <StarSelector
                    value={hostRating}
                    onChange={setHostRating}
                    label={lang === 'ar' ? 'تقييم قائد / مضيف الرحلة' : 'Host Coordination'}
                    icon={User}
                  />

                  <StarSelector
                    value={punctual}
                    onChange={setPunctual}
                    label={lang === 'ar' ? 'الالتزام التام بالوقت والانضباط' : 'Companion Punctuality'}
                    icon={Clock}
                  />

                  <StarSelector
                    value={friendlyRating}
                    onChange={setFriendlyRating}
                    label={lang === 'ar' ? 'روح الرفقة والتعامل اللطيف' : 'Companion Friendliness'}
                    icon={Heart}
                  />
                </div>

                {/* Comment Box */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 tracking-wider uppercase">
                    {t.commentLabel || 'Comment'}
                  </label>
                  <input
                    type="text"
                    placeholder={lang === 'ar' ? 'اكتب ملاحظة أو تجربة جميلة للذكرى...' : 'Any feedback?'}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full text-xs p-3 bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2.5 mt-2 pt-2">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-xs font-black transition-all cursor-pointer uppercase tracking-widest"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button 
                    onClick={handleSubmit}
                    className="flex-[2] flex justify-center items-center py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shadow-indigo-500/20 uppercase tracking-widest"
                  >
                    {lang === 'ar' ? 'تأكيد وإرسال التقييم' : 'Submit Review'}
                  </button>
                </div>
              </div>
            )}

            {showRatingSuccess && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 flex flex-col items-center justify-center space-y-4"
              >
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ duration: 0.5, type: 'spring' }}
                  className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center border-2 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.4)]"
                >
                  <CheckCircle className="w-10 h-10 text-indigo-400" />
                </motion.div>
                
                <div className="text-center space-y-1">
                  <h4 className="text-lg font-black text-white">
                    {lang === 'ar' ? 'شكراً لتقييمك!' : 'Thanks for reviewing!'}
                  </h4>
                  <p className="text-sm font-bold text-slate-400">
                    {lang === 'ar' ? 'تمت إضافة' : 'You earned'}
                  </p>
                </div>
                
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-4 py-2 rounded-xl border border-emerald-500/30 shadow-lg shadow-emerald-500/10"
                >
                  <Star className="w-5 h-5 text-emerald-400 fill-emerald-400" />
                  <span className="text-xl font-black text-emerald-300 tracking-wider">+50 XP</span>
                </motion.div>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-xs text-indigo-300 font-bold tracking-widest uppercase pt-2"
                >
                  {lang === 'ar' ? 'الموثوقية زادت' : 'Trust Score Incremented'}
                </motion.p>
              </motion.div>
            )}
            
            {selectedRevieweeId && submittedReviews.includes(selectedRevieweeId) && !showRatingSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-emerald-300 text-xs font-bold">{lang === 'ar' ? 'لقد قمت بتقييم هذا الرفيق مسبقاً.' : 'You have already reviewed this companion.'}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
