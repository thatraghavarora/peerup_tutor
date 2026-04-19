import { useState, useEffect, Component, ReactNode } from 'react';
import { LandingScreen } from './components/LandingScreen';
import { OTPScreen } from './components/OTPScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { supabase } from '../lib/supabase';

// Error boundary to prevent blank screens on crash
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-white text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-lg font-black text-red-600 mb-2">App Error</h2>
          <p className="text-xs text-slate-500 font-mono bg-slate-50 p-3 rounded-lg">{this.state.error}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-6 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('landing');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userName, setUserName] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [socialUser, setSocialUser] = useState<any>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) handleUser(session.user);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        handleUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setCurrentScreen('landing');
        setSocialUser(null);
        setUserName('');
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const handleUser = async (user: any) => {
    setSocialUser(user);
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      setUserName(profile.full_name || '');
      setCurrentScreen('dashboard');
    } else {
      setCurrentScreen('profile');
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 flex items-center justify-center overflow-hidden">
      <div className="w-full max-w-[430px] h-full bg-white flex flex-col relative overflow-hidden shadow-2xl">
        <ErrorBoundary>
          {currentScreen === 'landing' && (
            <LandingScreen
              onNext={(phone, result) => {
                setPhoneNumber(phone);
                setConfirmationResult(result);
                setCurrentScreen('otp');
              }}
              onSocialLogin={(user, existingDetails) => {
                setSocialUser(user);
                if (existingDetails) {
                  setUserName(existingDetails.full_name || user.displayName || '');
                  setCurrentScreen('dashboard');
                } else {
                  setUserName(user.displayName || '');
                  setCurrentScreen('profile');
                }
              }}
            />
          )}
          {currentScreen === 'otp' && (
            <OTPScreen
              phoneNumber={phoneNumber}
              confirmationResult={confirmationResult}
              onBack={() => setCurrentScreen('landing')}
              onNext={(isExistingUser, name) => {
                if (isExistingUser) {
                  setUserName(name || '');
                  setCurrentScreen('dashboard');
                } else {
                  setCurrentScreen('profile');
                }
              }}
              onEditPhone={() => setCurrentScreen('landing')}
            />
          )}
          {currentScreen === 'profile' && (
            <ProfileScreen
              phoneNumber={phoneNumber}
              socialUser={socialUser}
              onNext={(name) => {
                setUserName(name);
                setCurrentScreen('dashboard');
              }}
            />
          )}
          {currentScreen === 'dashboard' && (
            <DashboardScreen userName={userName} />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
