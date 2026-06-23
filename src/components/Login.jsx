import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Loader, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // MODIFICA CRUCIALE: Indirizzo esatto del tuo progetto GitHub Pages
        redirectTo: 'https://patrecktack.github.io/ganttdiagram/', 
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) setErrorMsg(error.message);
    setLoading(false);
  };
const handleGithubLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        // MODIFICA CRUCIALE: Indirizzo esatto del tuo progetto GitHub Pages
        redirectTo: 'https://patrecktack.github.io/ganttdiagram/', 
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) setErrorMsg(error.message);
    setLoading(false);
  };
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
      if (error.message.includes("Invalid login credentials")) setErrorMsg("Email o password errata");
      else if (error.message.includes("User already registered")) setErrorMsg("Questa email è già registrata.");
      else if (error.message.includes("Password should be at least")) setErrorMsg("La password deve avere almeno 6 caratteri.");
      else setErrorMsg(error.message);
    } else if (isSignUp) {
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
      // MODIFICA CRUCIALE: Anche qui l'indirizzo esatto
      redirectTo: 'https://patrecktack.github.io/ganttdiagram/',
    });

    if (error) setErrorMsg(error.message);
    else setSuccessMsg("Email di recupero inviata! Controlla la posta.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6 dark:bg-black transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-[#1C1C1E] rounded-[2rem] shadow-2xl p-8 animate-enter relative overflow-hidden">
        
        {registrationSuccess ? (
          <div className="text-center py-8 space-y-6 animate-enter">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-600 dark:text-green-400">
              <Mail size={48} />
            </div>
            <div>
              <h2 className="text-2xl font-bold dark:text-white">Controlla la tua posta!</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Link inviato a: <br/><span className="font-bold text-black dark:text-white">{email}</span></p>
            </div>
            <button onClick={() => { setRegistrationSuccess(false); setIsSignUp(false); }} className="w-full py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl">Torna al Login</button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold tracking-tight mb-2 dark:text-white">{isResetMode ? 'Recupero Password' : (isSignUp ? 'Crea Account' : 'Benvenuto')}</h1>
              <p className="text-gray-500 dark:text-gray-400">{isResetMode ? 'Ti invieremo un link per resettarla' : (isSignUp ? 'Inizia a gestire il tuo tempo' : 'Accedi per continuare')}</p>
            </div>

            {!isResetMode && (
              <div className="mb-6">
                <button onClick={handleGoogleLogin} type="button" className="w-full py-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl font-bold text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-sm">
                  <GoogleIcon /><span>Accedi con Google</span>
                </button>
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-200 dark:border-zinc-800"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold uppercase tracking-widest">Oppure</span>
                    <div className="flex-grow border-t border-gray-200 dark:border-zinc-800"></div>
                </div>
              </div>
            )}

            {isResetMode ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                 <div className="space-y-1 relative"><Mail className="absolute left-4 top-4 text-gray-400" size={20} /><input type="email" placeholder="La tua email" value={email} onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }} className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl border-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none font-medium dark:text-white" required /></div>
                {successMsg && <div className="p-3 bg-green-100 text-green-700 rounded-xl text-sm font-bold text-center flex items-center justify-center gap-2"><CheckCircle size={18}/> {successMsg}</div>}
                {errorMsg && <div className="flex items-center gap-2 text-red-500 text-sm font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-xl animate-pulse"><AlertCircle size={18} /> <span>{errorMsg}</span></div>}
                <button disabled={loading} className="w-full py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex justify-center items-center disabled:opacity-50">{loading ? <Loader className="animate-spin" /> : 'Invia Link di Reset'}</button>
                <button type="button" onClick={() => { setIsResetMode(false); setErrorMsg(''); setSuccessMsg(''); }} className="w-full py-2 text-gray-500 hover:text-black dark:hover:text-white font-bold text-sm flex items-center justify-center gap-2 mt-2"><ArrowLeft size={16}/> Torna al Login</button>
              </form>
            ) : (
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-1 relative"><Mail className="absolute left-4 top-4 text-gray-400" size={20} /><input type="email" placeholder="Email" value={email} onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }} className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl border-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none font-medium dark:text-white" required /></div>
                <div className="space-y-1 relative"><Lock className="absolute left-4 top-4 text-gray-400" size={20} /><input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }} className="w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl border-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none font-medium dark:text-white" required /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></div>
                {!isSignUp && <div className="flex justify-end"><button type="button" onClick={() => setIsResetMode(true)} className="text-xs font-bold text-gray-400 hover:text-black dark:hover:text-white transition-colors">Password dimenticata?</button></div>}
                {errorMsg && <div className="flex items-center gap-2 text-red-500 text-sm font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-xl animate-pulse"><AlertCircle size={18} /> <span>{errorMsg}</span></div>}
                <button disabled={loading} className="w-full py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex justify-center items-center disabled:opacity-50">{loading ? <Loader className="animate-spin" /> : (isSignUp ? 'Registrati' : 'Accedi')}</button>
              </form>
            )}
            {!isResetMode && <div className="mt-6 text-center"><button onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }} className="text-sm font-semibold text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors">{isSignUp ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}</button></div>}
          </>
        )}
      </div>
    </div>
  );
}
