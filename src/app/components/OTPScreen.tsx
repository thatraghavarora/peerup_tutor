import { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface OTPScreenProps {
  phoneNumber: string;
  confirmationResult: any;
  onBack: () => void;
  onNext: (isExistingUser: boolean, name?: string) => void;
  onEditPhone: () => void;
}

export function OTPScreen({ phoneNumber, confirmationResult, onBack, onNext, onEditPhone }: OTPScreenProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyUp = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    const code = otp.join('');
    try {
      if (confirmationResult) {
        await confirmationResult.confirm(code);
        const { data } = await supabase.from('users').select('*').eq('phone_number', phoneNumber).maybeSingle();
        if (data) onNext(true, data.full_name);
        else onNext(false);
      }
    } catch (err) {
      alert("Invalid OTP");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="h-full bg-white px-6 py-8 flex flex-col">
      <button onClick={onBack} className="mb-8 w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full">
        <ArrowLeft className="w-5 h-5 text-indigo-600" />
      </button>

      <h1 className="text-2xl font-black text-indigo-900 mb-2">Expert Verification</h1>
      <p className="text-gray-500 text-sm mb-1">Enter the 6-digit code sent to</p>
      <div className="flex items-center gap-2 mb-10">
        <span className="font-black text-indigo-600">+91 {phoneNumber}</span>
        <button onClick={onEditPhone} className="text-xs text-indigo-400 font-bold underline">Edit</button>
      </div>

      <div className="flex justify-between gap-2 mb-10">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={el => inputRefs.current[index] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleOtpChange(index, e.target.value.replace(/\D/g, ''))}
            onKeyUp={(e) => handleKeyUp(index, e)}
            className="w-12 h-14 text-center text-xl font-black border-2 border-indigo-50 bg-indigo-50 rounded-xl focus:border-indigo-600 focus:bg-white outline-none transition-all shadow-inner"
          />
        ))}
      </div>

      <button
        onClick={handleVerify}
        disabled={otp.some(d => !d) || verifying}
        className="w-full bg-indigo-600 text-white rounded-xl py-4 font-black shadow-lg shadow-indigo-100 disabled:opacity-50"
      >
        {verifying ? 'Verifying Expert Access...' : 'Verify & Continue'}
      </button>

      <p className="mt-6 text-center text-xs font-bold text-gray-400">
        Resend code in <span className="text-indigo-600">{countdown}s</span>
      </p>
    </div>
  );
}
