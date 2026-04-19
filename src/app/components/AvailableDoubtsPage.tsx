import { useState, useEffect } from 'react';
import { Search, Loader2, RefreshCcw, Clock, BookOpen, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AvailableDoubtsPageProps {
  onAccepted: (doubtId: string) => void;
}

export function AvailableDoubtsPage({ onAccepted }: AvailableDoubtsPageProps) {
  const [doubts, setDoubts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelStatus, setChannelStatus] = useState<string>('connecting');
  const [pendingDoubtId, setPendingDoubtId] = useState<string | null>(null);

  useEffect(() => {
    fetchDoubts();

    const channel = supabase
      .channel('doubts-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'doubts' }, () => fetchDoubts())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'doubts' }, () => fetchDoubts())
      .subscribe((status) => setChannelStatus(status));

    // Refresh every 10 seconds as fallback
    const interval = setInterval(fetchDoubts, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchDoubts = async () => {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('doubts')
      .select('*, student:profiles!student_id(full_name, id)')
      .eq('status', 'pending')
      .gt('created_at', twelveHoursAgo)
      .order('created_at', { ascending: false });

    if (!error) setDoubts(data || []);
    setLoading(false);
  };

  const handleAccept = async (doubtId: string, studentId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Try session fallback
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { alert('Not logged in'); return; }
    }

    const currentUser = (await supabase.auth.getSession()).data.session?.user
      || (await supabase.auth.getUser()).data.user;
    if (!currentUser) { alert('Auth failed'); return; }

    try {
      setPendingDoubtId(doubtId);

      // Step 1: Insert interest IMMEDIATELY (don't wait for channel)
      const { data: reqData, error: reqError } = await supabase
        .from('connect_requests')
        .insert({
          doubt_id: doubtId,
          teacher_id: currentUser.id,
          student_id: studentId,
          status: 'pending'
        })
        .select()
        .single();

      if (reqError) {
        console.error('Insert failed:', reqError);
        setPendingDoubtId(null);
        alert('Could not express interest: ' + reqError.message);
        return;
      }

      console.log('Request inserted:', reqData.id);

      // Step 2: Listen for student confirmation (Broadcast + DB)
      const handshakeChannel = supabase.channel(`handshake:${doubtId}`);
      handshakeChannel
        .on('broadcast', { event: 'student_confirmed' }, (evt) => {
          if (evt.payload?.teacher_id === currentUser.id) {
            console.log('Broadcast: Student confirmed!');
            supabase.removeChannel(handshakeChannel);
            onAccepted(doubtId);
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'connect_requests',
          filter: `doubt_id=eq.${doubtId}`
        }, (payload) => {
          if (payload.new.status === 'accepted' && payload.new.teacher_id === currentUser.id) {
            console.log('DB: Student confirmed!');
            supabase.removeChannel(handshakeChannel);
            onAccepted(doubtId);
          }
        })
        .subscribe();

      // Step 3: Also poll every 2s as fallback
      const pollInterval = setInterval(async () => {
        const { data } = await supabase
          .from('connect_requests')
          .select('status, teacher_id')
          .eq('id', reqData.id)
          .single();
        if (data?.status === 'accepted') {
          clearInterval(pollInterval);
          supabase.removeChannel(handshakeChannel);
          onAccepted(doubtId);
        }
      }, 2000);

      // Clean up poll after 3 minutes
      setTimeout(() => clearInterval(pollInterval), 180000);

    } catch (err: any) {
      console.error('handleAccept error:', err);
      setPendingDoubtId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input type="text" placeholder="Search subjects..." className="flex-1 bg-transparent outline-none text-sm text-slate-700 min-w-0" />
        </div>
      </div>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="font-black text-base text-slate-800">Live Doubt Feed</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${channelStatus === 'SUBSCRIBED' ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`} />
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {channelStatus === 'SUBSCRIBED' ? 'Realtime Active' : 'Connecting...'}
            </p>
          </div>
        </div>
        <button onClick={fetchDoubts} className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100">
          <RefreshCcw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Pending Banner */}
      {pendingDoubtId && (
        <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-amber-800">Waiting for student confirmation...</p>
            <p className="text-[9px] text-amber-500 mt-0.5">Student will see your request and connect</p>
          </div>
          <button onClick={() => setPendingDoubtId(null)} className="text-[9px] font-black text-red-400 uppercase flex-shrink-0">Cancel</button>
        </div>
      )}

      {/* Doubts List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mb-4 opacity-30" />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Scanning...</p>
          </div>
        ) : doubts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100 mt-2">
            <BookOpen className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-slate-400 font-black text-sm">No live doubts right now</p>
            <p className="text-[9px] text-slate-300 mt-1 uppercase tracking-widest font-bold">Waiting for students...</p>
            <button onClick={fetchDoubts} className="mt-4 text-[10px] font-black text-indigo-500 uppercase flex items-center gap-1">
              <RefreshCcw className="w-3 h-3" /> Refresh
            </button>
          </div>
        ) : (
          doubts.map((doubt) => (
            <div key={doubt.id} className={`bg-white border rounded-3xl p-4 shadow-sm transition-all ${pendingDoubtId === doubt.id ? 'border-amber-300 bg-amber-50/30' : 'border-slate-100 hover:border-indigo-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                  {doubt.subject}
                </span>
                <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(doubt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <p className="text-sm font-semibold text-slate-800 leading-snug mb-3">
                {doubt.content
                  ? (doubt.content.length > 100 ? doubt.content.slice(0, 100) + '...' : doubt.content)
                  : 'No content provided'}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 bg-indigo-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 truncate">
                    {doubt.student?.full_name || 'Anonymous'}
                  </span>
                </div>

                {pendingDoubtId === doubt.id ? (
                  <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 px-3 py-2 rounded-xl flex-shrink-0">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-[10px] font-black uppercase">Waiting...</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAccept(doubt.id, doubt.student_id)}
                    disabled={!!pendingDoubtId}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[11px] shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    Accept &amp; Solve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
