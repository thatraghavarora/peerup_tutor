import { useState, useEffect } from 'react';
import { User, Mail, Phone, Award, LogOut, ChevronRight, Star, Clock, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProfilePageProps {
  userName: string;
}

export function ProfilePage({ userName }: ProfilePageProps) {
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('email', user.email).maybeSingle();
        setUserData(data);
      }
    };
    fetchUserData();
  }, [userName]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="px-6 pt-6 pb-6">
      <div className="bg-gradient-to-br from-indigo-600 to-slate-800 rounded-2xl p-6 mb-6 text-white shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-white/20 border-2 border-white/50 rounded-full flex items-center justify-center text-3xl shadow-inner">
            👨‍🏫
          </div>
          <div>
            <h2 className="text-xl font-black">{userName}</h2>
            <div className="flex items-center gap-1 text-xs text-indigo-200 uppercase font-black tracking-widest">
              <Star className="w-3 h-3 fill-indigo-300 text-indigo-300" />
              <span>Expert Tutor • 4.9</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] text-indigo-200 uppercase font-black">Rating</p>
            <p className="text-lg font-bold">4.9/5.0</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] text-indigo-200 uppercase font-black">Experience</p>
            <p className="text-lg font-bold">3+ Years</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 shadow-sm">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Credentials</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Mail className="w-5 h-5" /></div>
            <div className="flex-1"><p className="text-[10px] text-gray-400 font-bold uppercase">Email</p><p className="text-sm font-bold truncate">{userData?.email || 'N/A'}</p></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Phone className="w-5 h-5" /></div>
            <div className="flex-1"><p className="text-[10px] text-gray-400 font-bold uppercase">Mobile</p><p className="text-sm font-bold">{userData?.phone_number || 'N/A'}</p></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Award className="w-5 h-5" /></div>
            <div className="flex-1"><p className="text-[10px] text-gray-400 font-bold uppercase">Expertise</p><p className="text-sm font-bold">{userData?.course_name || 'Expert Expert'}</p></div>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-red-50 text-red-600 border border-red-100 rounded-xl py-4 font-black flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        <span>Sign Out Expert Portal</span>
      </button>
    </div>
  );
}
