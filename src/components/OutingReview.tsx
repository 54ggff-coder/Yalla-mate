import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { Outing, OutingReview } from '../types';
import { Language } from '../data/translations';

interface OutingReviewProps {
  outing: Outing;
  revieweeId: string;
  reviewerId: string;
  lang: Language;
  onReviewSubmitted: (reviewData: OutingReview) => Promise<void>;
  onClose: () => void;
}

export default function OutingReviewComponent({ outing, revieweeId, reviewerId, lang, onReviewSubmitted, onClose }: OutingReviewProps) {
  const isAr = lang === 'ar';
  const [respectful, setRespectful] = useState(5);
  const [punctual, setPunctual] = useState(5);
  const [payment, setPayment] = useState(5);
  const [comment, setComment] = useState('');

  const handleSubmit = async () => {
    const review: OutingReview = {
      id: Math.random().toString(36).substr(2, 9),
      outingId: outing.id,
      reviewerId,
      revieweeId,
      respectfulRating: respectful,
      punctualRating: punctual,
      paymentRating: payment,
      friendlyRating: 5,
      comment,
    };
    await onReviewSubmitted(review);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col p-6">
      <h2 className="text-xl font-black mb-6">{isAr ? 'تقييم الصحبة' : 'Rate Companion'}</h2>
      
      <div className="space-y-4 mb-6">
        {[
          { label: isAr ? 'احترام' : 'Respect', rating: respectful, setter: setRespectful },
          { label: isAr ? 'دقة المواعيد' : 'Punctuality', rating: punctual, setter: setPunctual },
          { label: isAr ? 'الدفع' : 'Payment', rating: payment, setter: setPayment },
        ].map(({ label, rating, setter }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-sm font-bold">{label}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-6 h-6 cursor-pointer ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                  onClick={() => setter(star)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <textarea
        className="w-full h-24 p-3 border rounded-xl mb-6 text-sm"
        placeholder={isAr ? 'أضف تعليقاً...' : 'Add a comment...'}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <button onClick={handleSubmit} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">
        {isAr ? 'إرسال التقييم' : 'Submit Review'}
      </button>
    </div>
  );
}
