import { useState, useEffect } from 'react';
import { TrendingUp, ArrowUpRight, CheckCircle2, DollarSign, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function EarningsPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('solved_history')
      .select('*, doubts(subject, content)')
      .eq('teacher_id', user.id)
      .order('solved_at', { ascending: false });

    if (!error && data) {
      setHistory(data);
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
      {/* Earnings Summary Card - Now Solved Summary */}
      <div className="bg-gradient-to-br from-indigo-600 to-slate-900 rounded-3xl p-8 text-white mb-6 shadow-2xl shadow-indigo-200/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <CheckCircle2 className="w-24 h-24" />
        </div>
        <p className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-1">Your Progress</p>
        <h2 className="text-5xl font-black mb-8">{history.length} <span className="text-xl font-normal opacity-60 uppercase">Solved</span></h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] text-indigo-200 uppercase tracking-widest font-black mb-1">Lifetime</p>
            <p className="text-xl font-bold">{history.length} Sessions</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] text-indigo-200 uppercase tracking-widest font-black mb-1">Success Rate</p>
            <p className="text-xl font-bold">100%</p>
          </div>
        </div>
      </div>

      <button className="w-full bg-white border-2 border-indigo-100 text-indigo-600 rounded-2xl py-5 font-black flex items-center justify-center gap-3 mb-10 hover:bg-indigo-50 transition-all shadow-sm uppercase tracking-widest text-xs">
        View Performance details
        <ArrowUpRight className="w-5 h-5" />
      </button>

      <div className="flex justify-between items-end mb-6">
        <h3 className="font-black text-xl text-slate-800">Solved History</h3>
        <span className="text-[10px] font-black text-indigo-400 uppercase">Recent Sessions</span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Loading records...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
          <p className="text-gray-400 font-bold">No sessions solved yet.</p>
          <p className="text-[10px] text-gray-400 uppercase mt-1">Accept doubts to start your journey!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item, idx) => (
            <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-sm">{item.doubts?.subject || 'Solved Doubt'}</h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(item.solved_at).toLocaleDateString()} • {item.resolution_type}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Verified</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
