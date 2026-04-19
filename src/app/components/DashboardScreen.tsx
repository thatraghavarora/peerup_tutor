import { useState, useRef } from 'react';
import { LayoutDashboard, Wallet, User, Bell, PhoneIncoming, Loader2 } from 'lucide-react';
import { AvailableDoubtsPage } from './AvailableDoubtsPage';
import { EarningsPage } from './EarningsPage';
import { ProfilePage } from './ProfilePage';
import { ChatScreen } from './ChatScreen';

interface DashboardScreenProps {
  userName: string;
}

export function DashboardScreen({ userName }: DashboardScreenProps) {
  const [activeTab, setActiveTab] = useState('doubts');
  const [activeDoubtId, setActiveDoubtId] = useState<string | null>(null);
  // Reconnect state
  const [lastSession, setLastSession] = useState<{ doubtId: string } | null>(null);
  const [reconnectCountdown, setReconnectCountdown] = useState(0);
  const reconnectTimer = useRef<any>(null);

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length === 0) return '??';
    return parts.map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLeaveSession = (doubtId: string) => {
    setActiveDoubtId(null);
    setLastSession({ doubtId });
    setReconnectCountdown(60);
    if (reconnectTimer.current) clearInterval(reconnectTimer.current);
    reconnectTimer.current = setInterval(() => {
      setReconnectCountdown(prev => {
        if (prev <= 1) {
          clearInterval(reconnectTimer.current);
          setLastSession(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRejoin = () => {
    if (lastSession) {
      clearInterval(reconnectTimer.current);
      setLastSession(null);
      setReconnectCountdown(0);
      setActiveDoubtId(lastSession.doubtId);
    }
  };

  const dismissReconnect = () => {
    clearInterval(reconnectTimer.current);
    setLastSession(null);
    setReconnectCountdown(0);
  };

  return (
    <div className="h-full bg-slate-50 flex flex-col relative overflow-hidden">
      {/* Top Bar */}
      <div className="flex flex-col bg-white border-b border-gray-200">
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">Peerup Expert</p>
            <h1 className="text-base font-black text-slate-800">Welcome, {userName.split(' ')[0]}!</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-700 font-black text-sm">
              {getInitials(userName)}
            </div>
            <button className="relative p-2 bg-indigo-50 rounded-full">
              <Bell className="w-4 h-4 text-indigo-600" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
            </button>
          </div>
        </div>

        {/* Reconnect Banner */}
        {lastSession && reconnectCountdown > 0 && (
          <div className="w-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <PhoneIncoming className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-xs leading-none">Session Still Active!</p>
              <p className="text-white/70 text-[10px] font-bold mt-0.5">Rejoin expires in {reconnectCountdown}s</p>
            </div>
            <button
              onClick={handleRejoin}
              className="bg-white text-orange-600 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-md hover:scale-105 active:scale-95 transition-all flex-shrink-0"
            >
              Rejoin
            </button>
            <button onClick={dismissReconnect} className="text-white/60 hover:text-white transition-colors flex-shrink-0">
              <span className="text-xl leading-none">×</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 pb-20 overflow-auto">
        {activeTab === 'doubts' && (
          <AvailableDoubtsPage onAccepted={(id) => setActiveDoubtId(id)} />
        )}
        {activeTab === 'earnings' && <EarningsPage />}
        {activeTab === 'profile' && <ProfilePage userName={userName} />}
      </div>

      {/* Chat/Meeting Overlay */}
      {activeDoubtId && (
        <div className="absolute inset-0 z-50 bg-white">
          <ChatScreen
            doubtId={activeDoubtId}
            onBack={() => handleLeaveSession(activeDoubtId)}
          />
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-around items-center shadow-lg">
        <button
          onClick={() => setActiveTab('doubts')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'doubts' ? 'text-indigo-600 scale-110' : 'text-gray-400'}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-bold">Doubts</span>
        </button>
        <button
          onClick={() => setActiveTab('earnings')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'earnings' ? 'text-indigo-600 scale-110' : 'text-gray-400'}`}
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[10px] font-bold">Earnings</span>
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'text-indigo-600 scale-110' : 'text-gray-400'}`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-bold">Profile</span>
        </button>
      </div>
    </div>
  );
}
