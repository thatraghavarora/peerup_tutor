import { useState } from 'react';
import { Award, Info, BookCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProfileScreenProps {
  onNext: (name: string) => void;
  phoneNumber?: string;
  socialUser?: any;
}

export function ProfileScreen({ onNext, phoneNumber, socialUser }: ProfileScreenProps) {
  const [name, setName] = useState(socialUser?.displayName || '');
  const [expertise, setExpertise] = useState('');
  const [qualification, setQualification] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (name.trim() && expertise.trim()) {
      setLoading(true);
      try {
        // Try session first (uses cached token), then getUser as fallback
        let userId: string | null = null;
        let userEmail: string | null = null;

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          userId = session.user.id;
          userEmail = session.user.email || null;
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            userId = user.id;
            userEmail = user.email || null;
          }
        }

        if (!userId) {
          alert('Session expired. Please log in again.');
          return;
        }

        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            full_name: name,
            email: userEmail || socialUser?.email || null,
            course_name: expertise,
            semester: qualification,
            role: 'teacher'
          });

        if (error) throw error;
        onNext(name);
      } catch (err: any) {
        console.error('Profile Save Error:', err);
        alert(`Failed to save profile: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="h-full bg-white px-6 py-8 flex flex-col overflow-y-auto">
      <h1 className="text-2xl font-black text-indigo-900 mb-8">Tutor Registration</h1>
      
      <div className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
        <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mb-1">Authenticated via</p>
        <p className="text-sm font-bold text-slate-800">{phoneNumber || socialUser?.email}</p>
      </div>

      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Display Name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="text-lg bg-gray-50 border-b-2 border-indigo-100 p-3 mb-8 outline-none focus:border-indigo-600 focus:bg-white transition-all rounded-t-xl"
        placeholder="e.g., Prof. Raghav"
      />

      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
        Teaching Expertise <BookCheck className="w-3 h-3" />
      </label>
      <input
        type="text"
        value={expertise}
        onChange={(e) => setExpertise(e.target.value)}
        className="text-lg bg-gray-50 border-b-2 border-indigo-100 p-3 mb-8 outline-none focus:border-indigo-600 focus:bg-white transition-all rounded-t-xl"
        placeholder="e.g., JEE Mathematics"
      />

      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
        Highest Qualification <Award className="w-3 h-3" />
      </label>
      <input
        type="text"
        value={qualification}
        onChange={(e) => setQualification(e.target.value)}
        className="text-lg bg-gray-50 border-b-2 border-indigo-100 p-3 mb-8 outline-none focus:border-indigo-600 focus:bg-white transition-all rounded-t-xl"
        placeholder="e.g., M.Sc in Physics"
      />

      <div className="flex-1" />

      <button
        onClick={handleContinue}
        disabled={!name.trim() || !expertise.trim() || loading}
        className="w-full bg-indigo-600 text-white rounded-xl py-4 font-black shadow-lg shadow-indigo-100 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Complete Registration'}
      </button>
    </div>
  );
}
