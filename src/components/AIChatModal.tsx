import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Bot, User, Sparkles } from 'lucide-react';
import { Language } from '../data/translations';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export default function AIChatModal({ isOpen, onClose, lang }: AIChatModalProps) {
  const isAr = lang === 'ar';
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: isAr ? 'أهلاً! أنا مساعدك الذكي في YallaMate. كيف يمكنني مساعدتك اليوم؟' : 'Hi! I\'m your YallaMate AI Assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, { role: 'user', content: userMessage }], lang }),
      });
      const data = await response.json();
      if (data.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: isAr ? 'عذراً، حدث خطأ.' : 'Sorry, an error occurred.' }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: isAr ? 'لا يمكن الاتصال بالسيرفر.' : 'Cannot connect to server.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-full">
                <Bot className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-lg text-slate-900">{isAr ? 'مساعد YallaMate الذكي' : 'YallaMate AI Assistant'}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && <div className="text-sm text-slate-400 italic">Thinking...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isAr ? 'اكتب رسالتك...' : 'Type your message...'}
              className="flex-1 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-slate-300"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
