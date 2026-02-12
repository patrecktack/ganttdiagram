import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Loader, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Stati per la modalità
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  // NUOVO: Stato per la schermata di successo registrazione
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    let error;
    
    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      error = signUpError;
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      error = signInError;
    }

    if (error) {
      // Traduzione errori
      if (error.message.includes("Invalid login credentials")) setErrorMsg("Email o password errata");
      else if (error.message.includes("User already registered")) setErrorMsg("Questa email è già registrata.");
      else if (error.message.includes("Password should be at least")) setErrorMsg("La password deve avere almeno 6 caratteri.");
      else setErrorMsg(error.message);
    } else if (isSignUp) {
      // SE LA REGISTRAZIONE VA A BUON FINE, MOSTRIAMO LA SCHERMATA CARINA
      setRegistrationSuccess(true);
    }
    
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) { setErrorMsg("Inserisci la tua email."); return; }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg("Email di recupero inviata! Controlla la posta.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6 dark:bg-black transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-[#1C1C1E] rounded-[2rem] shadow-2xl p-8 animate-enter relative overflow-hidden">
        
        {/* --- SCHERMATA SUCCESSO REGISTRAZIONE (NUOVA) --- */}
        {registrationSuccess ? (
          <div className="text-center py-8 space-y-6 animate-enter">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-600 dark:text-green-400">
              <Mail size={48} />
            </div>
            <div>
              <h2 className="text-2xl font-bold dark:text-white">Controlla la tua posta!</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                Ti abbiamo inviato un link di conferma a:
                <br />
                <span className="font-bold text-black dark:text-white">{email}</span>
              </p>
            </div>
            <button 
              onClick={() => { setRegistrationSuccess(false); setIsSignUp(false); }}
              className="w-full py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
            >
              Torna al Login
            </button>
          </div>
        ) : (
          /* --- CONTENUTO NORMALE (LOGIN/SIGNUP/RESET) --- */
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold tracking-tight mb-2 dark:text-white">
                {isResetMode ? 'Recupero Password' : (isSignUp ? 'Crea Account' : 'Benvenuto')}
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                {isResetMode ? 'Ti invieremo un link per resettarla' : (isSignUp ? 'Inizia a gestire il tuo tempo' : 'Accedi per continuare')}
              </p>
            </div>

            {isResetMode ? (
              /* FORM RESET PASSWORD */
              <form onSubmit={handleResetPassword} className="space-y-4">
                 <div className="space-y-1 relative">
                  <Mail className="absolute left-4 top-4 text-gray-400" size={20} />
                  <input type="email" placeholder="La tua email" value={email} onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }} className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl border-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none font-medium dark:text-white" required />
                </div>

                {successMsg && (
                  <div className="p-3 bg-green-100 text-green-700 rounded-xl text-sm font-bold text-center flex items-center justify-center gap-2">
                    <CheckCircle size={18}/> {successMsg}
                  </div>
                )}
                
                {errorMsg && (
                  <div className="flex items-center gap-2 text-red-500 text-sm font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-xl animate-pulse">
                      <AlertCircle size={18} /> <span>{errorMsg}</span>
                  </div>
                )}

                <button disabled={loading} className="w-full py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex justify-center items-center disabled:opacity-50">
                  {loading ? <Loader className="animate-spin" /> : 'Invia Link di Reset'}
                </button>
                
                <button type="button" onClick={() => { setIsResetMode(false); setErrorMsg(''); setSuccessMsg(''); }} className="w-full py-2 text-gray-500 hover:text-black dark:hover:text-white font-bold text-sm flex items-center justify-center gap-2 mt-2">
                  <ArrowLeft size={16}/> Torna al Login
                </button>
              </form>
            ) : (
              /* FORM LOGIN / REGISTRAZIONE */
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-1 relative">
                  <Mail className="absolute left-4 top-4 text-gray-400" size={20} />
                  <input type="email" placeholder="Email" value={email} onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }} className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl border-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none font-medium dark:text-white" required />
                </div>

                <div className="space-y-1 relative">
                  <Lock className="absolute left-4 top-4 text-gray-400" size={20} />
                  <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }} className="w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl border-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none font-medium dark:text-white" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {!isSignUp && (
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setIsResetMode(true)} className="text-xs font-bold text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                      Password dimenticata?
                    </button>
                  </div>
                )}

                {errorMsg && (
                  <div className="flex items-center gap-2 text-red-500 text-sm font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-xl animate-pulse">
                      <AlertCircle size={18} /> <span>{errorMsg}</span>
                  </div>
                )}

                <button disabled={loading} className="w-full py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex justify-center items-center disabled:opacity-50">
                  {loading ? <Loader className="animate-spin" /> : (isSignUp ? 'Registrati' : 'Accedi')}
                </button>
              </form>
            )}

            {!isResetMode && (
              <div className="mt-6 text-center">
                <button onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }} className="text-sm font-semibold text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors">
                  {isSignUp ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}