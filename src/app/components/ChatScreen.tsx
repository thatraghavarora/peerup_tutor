import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Image as ImageIcon, CheckCircle, Star, MessageSquare, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { VideoCallScreen } from './VideoCallScreen';

interface ChatScreenProps {
  doubtId: string;
  onBack: () => void;
}

export function ChatScreen({ doubtId, onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [doubtDetails, setDoubtDetails] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  // Don't auto-launch call — wait until currentUser is confirmed loaded
  const [activeCall, setActiveCall] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInitialData();

    const channel = supabase
      .channel(`chat:${doubtId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `doubt_id=eq.${doubtId}` 
      }, payload => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doubtId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchInitialData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);

    const { data: doubt } = await supabase
      .from('doubts')
      .select('*, student:profiles!student_id(full_name)')
      .eq('id', doubtId)
      .single();
    setDoubtDetails(doubt);

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('doubt_id', doubtId)
      .order('created_at', { ascending: true });
    setMessages(msgs || []);

    // Auto-launch video call once user is confirmed
    if (user) setActiveCall(true);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        doubt_id: doubtId,
        sender_id: currentUser.id,
        content: newMessage
      });

    if (!error) setNewMessage('');
  };

  const finishSession = async () => {
    try {
      await supabase
        .from('doubts')
        .update({ status: 'solved' })
        .eq('id', doubtId);
      onBack();
    } catch (err) {
      alert("Error closing session");
    }
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 hover:bg-gray-50 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-indigo-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm leading-tight text-slate-900">Expert Console</h3>
              <span className="bg-green-50 text-green-600 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-green-100">Live</span>
            </div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
              Solving {doubtDetails?.student?.full_name}'s Doubt
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveCall(true)}
            className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Video className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsFinishing(true)}
            className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-indigo-100"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Video Call Overlay — only mount when currentUser is ready */}
      {activeCall && currentUser?.id && (
        <div className="absolute inset-0 z-[60] bg-black">
          <VideoCallScreen 
            doubtId={doubtId}
            currentUserId={currentUser.id}
            remoteName={doubtDetails?.student?.full_name || 'Student'} 
            onEnd={() => setActiveCall(false)} 
          />
        </div>
      )}

      {/* Finishing Overlay */}
      {isFinishing && (
        <div className="absolute inset-0 z-50 bg-indigo-900/90 backdrop-blur-sm flex items-center justify-center p-8 text-center">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-2">Mark as Solved?</h3>
            <p className="text-gray-500 text-sm mb-8">Confirm if you have provided a complete solution to the student.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsFinishing(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold">No, Back</button>
              <button onClick={finishSession} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold">Yes, Solved!</button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {/* Doubt Context */}
        <div className="bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm mb-6">
          <div className="flex justify-between items-center mb-2">
             <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{doubtDetails?.subject}</span>
             <span className="text-[10px] text-gray-400">{new Date(doubtDetails?.created_at).toLocaleTimeString()}</span>
          </div>
          <p className="text-sm font-bold text-slate-800 leading-relaxed mb-3">{doubtDetails?.content}</p>
          {doubtDetails?.image_url && (
            <img src={doubtDetails.image_url} alt="Doubt" className="rounded-lg w-full max-h-40 object-cover border-2 border-slate-50" />
          )}
        </div>

        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${
              msg.sender_id === currentUser?.id 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
            }`}>
              {msg.content}
              <p className={`text-[8px] mt-2 font-bold opacity-50 ${msg.sender_id === currentUser?.id ? 'text-right' : 'text-left'}`}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex items-center gap-2 bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100 focus-within:border-indigo-400 transition-colors">
          <input 
            type="text" 
            placeholder="Type your explanation..." 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400"
          />
          <button 
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="p-2.5 bg-indigo-600 text-white rounded-xl disabled:opacity-50 shadow-md shadow-indigo-100 hover:scale-105 active:scale-95 transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
