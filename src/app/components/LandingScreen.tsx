import { useState, useEffect } from 'react';
import { auth, setupRecaptcha } from '../../lib/firebase';
import { signInWithPhoneNumber } from 'firebase/auth';
import { supabase } from '../../lib/supabase';

interface LandingScreenProps {
  onNext: (phone: string, confirmationResult: any) => void;
  onSocialLogin: (user: any, existingDetails?: any) => void;
}

export function LandingScreen({ onNext, onSocialLogin }: LandingScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    try {
      setupRecaptcha('recaptcha-container');
    } catch (e) {
      console.warn('Recaptcha setup failed:', e);
    }
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://peerup-tutor.vercel.app/'
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error("Google Login Error:", error);
      alert("Google Login failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (phoneNumber.length === 10) {
      setLoading(true);
      try {
        const appVerifier = window.recaptchaVerifier;
        const confirmationResult = await signInWithPhoneNumber(auth, `+91${phoneNumber}`, appVerifier);
        onNext(phoneNumber, confirmationResult);
      } catch (error) {
        console.error("SMS Error:", error);
        alert("Failed to send SMS.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="relative bg-gradient-to-b from-indigo-100 to-indigo-50 px-6 pt-12 pb-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-50">
          <div className="absolute top-[10%] left-[5%] bg-white px-3 py-1.5 rounded-full text-xs font-bold text-indigo-600">TEACH MATH</div>
          <div className="absolute top-[20%] right-[10%] bg-white px-3 py-1.5 rounded-full text-xs font-bold text-indigo-600">EARN MONEY</div>
          <div className="absolute top-[35%] left-[15%] bg-white px-3 py-1.5 rounded-full text-xs font-bold text-indigo-600">SOLVE DOUBTS</div>
          <div className="absolute top-[50%] right-[5%] bg-white px-3 py-1.5 rounded-full text-xs font-bold text-indigo-600">FLEXIBLE HOURS</div>
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="text-8xl mb-4">🎓</div>
          <h1 className="text-2xl font-bold text-indigo-900">Peerup Tutor</h1>
        </div>
      </div>

      <div className="flex-1 bg-white px-6 py-8 flex flex-col">
        <h1 className="text-2xl font-bold text-center mb-2">
          Help Students &<br />Start Earning Today
        </h1>
        <p className="text-gray-500 text-center mb-8">Login as an Expert Tutor</p>

        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4">
          <span className="mr-3 text-gray-500">+91</span>
          <input
            type="tel"
            placeholder="Mobile number"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="flex-1 bg-transparent outline-none"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={phoneNumber.length !== 10 || loading}
          className="w-full bg-indigo-600 text-white rounded-xl py-3.5 font-bold mb-4 disabled:opacity-50"
        >
          {loading ? 'Sending OTP...' : 'Login to Teach'}
        </button>

        <div className="flex items-center my-4">
          <div className="flex-1 border-t border-gray-200"></div>
          <span className="px-3 text-gray-400 text-sm">Or</span>
          <div className="flex-1 border-t border-gray-200"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl py-3.5 font-medium"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}
