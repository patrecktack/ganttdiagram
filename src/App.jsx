import React, { useState, useEffect, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, LogOut, Moon, Sun, Calendar, Trash2, Settings, User, Lock, Mail, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { 
  format, addDays, addWeeks, addMonths, addYears, 
  differenceInCalendarDays, startOfDay, 
  startOfWeek, startOfMonth, endOfMonth, endOfWeek,
  setYear, setMonth, eachDayOfInterval, getYear, isSameMonth, isSameDay
} from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from './supabaseClient';

import Login from './components/Login';
import Gantt from './components/Gantt';

const COLORS = [
  { class: 'bg-black dark:bg-white text-white dark:text-black' },
  { class: 'bg-red-500 text-white' },
  { class: 'bg-orange-500 text-white' },
  { class: 'bg-amber-400 text-black' }, 
  { class: 'bg-lime-500 text-black' },
  { class: 'bg-emerald-500 text-white' },
  { class: 'bg-teal-500 text-white' },
  { class: 'bg-cyan-400 text-black' },
  { class: 'bg-blue-600 text-white' },
  { class: 'bg-indigo-500 text-white' },
  { class: 'bg-purple-600 text-white' },
  { class: 'bg-pink-500 text-white' },
  { class: 'bg-zinc-500 text-white' },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [activities, setActivities] = useState([]);
  
  const [viewMode, setViewMode] = useState('month'); 
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [pickerDate, setPickerDate] = useState(new Date()); 
  const [activeDatePicker, setActiveDatePicker] = useState(null); 
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [formActivity, setFormActivity] = useState({ id: null, title: '', start: new Date(), end: new Date(), color: COLORS[0].class });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // --- NUOVI STATI PER I POPUP APPLE STYLE ---
  const [customAlert, setCustomAlert] = useState(null); // { title, message, type: 'error'|'success' }
  const [isDeleteAccountConfirmOpen, setIsDeleteAccountConfirmOpen] = useState(false);

  // Stati per le impostazioni account
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(false);

  const dropdownRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchActivities = async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', session.user.id);
    
    if (data) {
      const formatted = data.map(a => ({
          ...a, 
          start: new Date(a.start), 
          id: a.id 
      }));
      setActivities(formatted);
    }
  };

  useEffect(() => {
    if (session) fetchActivities();
    else setActivities([]); 
  }, [session]);

  // --- FUNZIONE HELPER PER MOSTRARE ALERT ---
  const showAppleAlert = (title, message, type = 'error') => {
    setCustomAlert({ title, message, type });
  };

  const handleSaveActivity = async () => {
    if (!formActivity.title || !session) return;
    const daysDiff = differenceInCalendarDays(formActivity.end, formActivity.start) + 1;
    
    // SOSTITUITO ALERT BROWSER CON APPLE ALERT
    if (daysDiff < 1) { 
        showAppleAlert("Attenzione", "La data di fine deve essere dopo la data di inizio.", "error");
        return; 
    }

    const activityData = {
      title: formActivity.title,
      start: formActivity.start.toISOString(),
      days: daysDiff,
      color: formActivity.color,
      user_id: session.user.id
    };

    if (formActivity.id) {
      await supabase.from('activities').update(activityData).eq('id', formActivity.id);
    } else {
      await supabase.from('activities').insert([activityData]);
    }
    
    fetchActivities();
    setIsModalOpen(false);
    setActiveDatePicker(null); 
    setFormActivity({ id: null, title: '', start: new Date(), end: new Date(), color: COLORS[0].class });
  };

  const confirmDelete = async () => {
    if (formActivity.id) {
        await supabase.from('activities').delete().eq('id', formActivity.id);
        fetchActivities();
    }
    setIsModalOpen(false);
  };

  // --- FUNZIONI PER IMPOSTAZIONI ACCOUNT ---
  
  const handleUpdateEmail = async () => {
    if(!newEmail) return;
    setLoadingSettings(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setLoadingSettings(false);
    
    if (error) showAppleAlert("Errore", error.message, "error");
    else showAppleAlert("Controlla la posta", "Ti abbiamo inviato una mail per confermare il cambio indirizzo.", "success");
  };

  const handleUpdatePassword = async () => {
    if(!newPassword) return;
    setLoadingSettings(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoadingSettings(false);
    
    if (error) showAppleAlert("Errore", error.message, "error");
    else { 
        showAppleAlert("Password Aggiornata", "La tua password è stata modificata con successo.", "success"); 
        setNewPassword(''); 
    }
  };

  // Funzione che apre il modale di conferma (invece di window.confirm)
  const requestDeleteAccount = () => {
    setIsDeleteAccountConfirmOpen(true);
  };

  const handleDeleteAccountReal = async () => {
    setLoadingSettings(true);
    // 1. Cancella i dati
    await supabase.from('activities').delete().eq('user_id', session.user.id);
    await supabase.from('profiles').delete().eq('id', session.user.id);
    
    // 2. Chiama la funzione SQL per cancellare l'utente auth
    const { error } = await supabase.rpc('delete_user');
    
    setLoadingSettings(false);
    setIsDeleteAccountConfirmOpen(false); // Chiude modale
    
    if (error) {
      console.error(error);
      showAppleAlert("Errore", "Impossibile cancellare l'account. Prova a fare Logout e rientrare.", "error");
    } else {
      await supabase.auth.signOut();
      // Non serve alert qui, l'utente viene buttato fuori
    }
  };

  const handleUpdateActivityDrag = async (updatedActivity) => {
    setActivities(prev => prev.map(a => a.id === updatedActivity.id ? updatedActivity : a));
    await supabase.from('activities').update({
        start: updatedActivity.start.toISOString(),
        days: updatedActivity.days
    }).eq('id', updatedActivity.id);
  };

  useEffect(() => {
    if (isDarkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); } 
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDarkMode]);

  useEffect(() => { if (isDateDropdownOpen) setPickerDate(currentDate); }, [isDateDropdownOpen, currentDate]);
  useEffect(() => {
    function handleClickOutside(event) { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDateDropdownOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavigate = (direction) => {
    const amount = direction === 'next' ? 1 : -1;
    if (viewMode === 'week') setCurrentDate(d => addWeeks(d, amount));
    if (viewMode === 'month') setCurrentDate(d => addMonths(d, amount));
    if (viewMode === 'year') setCurrentDate(d => addYears(d, amount));
  };

  const getHeaderTitle = () => {
    if (viewMode === 'year') return format(currentDate, 'yyyy', {locale: it});
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', {locale: it});
    if (viewMode === 'week') { const start = startOfWeek(currentDate, { weekStartsOn: 1 }); return `Sett. ${format(start, 'd MMM', {locale: it})}`; }
  };

  const openNewModal = (date) => {
    let start = startOfDay(date);
    if (viewMode === 'year') start = startOfMonth(date);
    setFormActivity({ id: null, title: '', start: start, end: start, color: COLORS[0].class });
    setShowDeleteConfirm(false);
    setIsModalOpen(true);
    setActiveDatePicker(null); 
  };

  const openEditModal = (activity) => {
    const endDate = addDays(activity.start, activity.days - 1);
    setFormActivity({ id: activity.id, title: activity.title, start: activity.start, end: endDate, color: activity.color });
    setPickerDate(activity.start);
    setShowDeleteConfirm(false);
    setIsModalOpen(true);
    setActiveDatePicker(null);
  };

  const renderCustomCalendar = (targetField) => {
    const start = startOfWeek(startOfMonth(pickerDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(pickerDate), { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start, end }); 
    return (
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-4 animate-enter mt-2 border border-gray-200 dark:border-zinc-700">
         <div className="flex justify-between items-center mb-4">
            <button onClick={() => setPickerDate(addMonths(pickerDate, -1))} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded"><ChevronLeft size={18}/></button>
            <span className="font-bold capitalize text-sm">{format(pickerDate, 'MMMM yyyy', {locale:it})}</span>
            <button onClick={() => setPickerDate(addMonths(pickerDate, 1))} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded"><ChevronRight size={18}/></button>
         </div>
         <div className="grid grid-cols-7 gap-1 text-center mb-2">{['L','M','M','G','V','S','D'].map(d => <span key={d} className="text-[10px] text-gray-400 font-bold">{d}</span>)}</div>
         <div className="grid grid-cols-7 gap-1">
           {calendarDays.map((d, i) => {
             const isSelected = isSameDay(d, formActivity[targetField]);
             const isCurrentMonth = isSameMonth(d, pickerDate);
             return ( <button key={i} onClick={() => { setFormActivity(prev => ({ ...prev, [targetField]: d })); setActiveDatePicker(null); }} className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${isSelected ? 'bg-black text-white dark:bg-white dark:text-black shadow-lg scale-110' : isCurrentMonth ? 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-600' : 'text-gray-300 dark:text-zinc-600'}`}>{format(d, 'd')}</button> );
           })}
         </div>
      </div>
    );
  };

  const renderHeaderDateContent = () => {
    if (viewMode === 'week' || viewMode === 'month') {
        return ( <div className="p-1"><div className="flex justify-between items-center mb-4"><button onClick={() => setPickerDate(addYears(pickerDate, -1))} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><ChevronLeft size={16}/></button><span className="font-bold">{format(pickerDate, 'yyyy')}</span><button onClick={() => setPickerDate(addYears(pickerDate, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><ChevronRight size={16}/></button></div><div className="grid grid-cols-3 gap-2">{Array.from({ length: 12 }).map((_, i) => (<button key={i} onClick={() => { setCurrentDate(setMonth(setYear(new Date(), getYear(pickerDate)), i)); setIsDateDropdownOpen(false); }} className={`py-2 text-xs font-bold rounded-lg capitalize transition-colors ${currentDate.getMonth() === i && currentDate.getFullYear() === pickerDate.getFullYear() ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-100 dark:hover:bg-zinc-800'}`}>{format(new Date(2024, i, 1), 'MMM', { locale: it })}</button>))}</div></div> );
    }
    if (viewMode === 'year') {
        const currentYear = getYear(pickerDate);
        const startYear = currentYear - 4; const years = Array.from({ length: 9 }).map((_, i) => startYear + i);
        return ( <div className="p-1"><div className="flex justify-between items-center mb-4"><button onClick={() => setPickerDate(addYears(pickerDate, -9))} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><ChevronLeft size={16}/></button><span className="font-bold text-xs uppercase tracking-widest text-gray-400">Seleziona Anno</span><button onClick={() => setPickerDate(addYears(pickerDate, 9))} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><ChevronRight size={16}/></button></div><div className="grid grid-cols-3 gap-2">{years.map((y) => (<button key={y} onClick={() => { setCurrentDate(setYear(new Date(), y)); setIsDateDropdownOpen(false); }} className={`py-3 text-sm font-bold rounded-lg transition-colors ${y === getYear(currentDate) ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-100 dark:hover:bg-zinc-800'}`}>{y}</button>))}</div></div> );
    }
  };

  if (!session) return <><button onClick={() => setIsDarkMode(!isDarkMode)} className="fixed top-6 right-6 p-3 rounded-full bg-gray-100 dark:bg-zinc-800 hover:scale-110 transition-transform z-50 text-black dark:text-white">{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button><Login /></>;

  return (
    <div className="h-screen flex flex-col overflow-hidden select-none bg-gray-50 text-slate-900 dark:bg-black dark:text-white transition-colors duration-500">
      <header className="px-6 py-4 flex flex-col sm:flex-row justify-between items-center animate-enter z-50 gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto relative" ref={dropdownRef}>
          <div className="flex items-center gap-1 rounded-full p-1 pr-5 shadow-sm border transition-colors bg-white border-gray-100 dark:bg-zinc-900 dark:border-zinc-800 relative z-20">
            <button onClick={() => handleNavigate('prev')} className="p-2 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"><ChevronLeft size={18}/></button>
            <button onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)} className={`text-sm font-bold capitalize w-32 text-center truncate py-1 px-2 rounded-md transition-colors flex items-center justify-center gap-1 ${isDateDropdownOpen ? 'bg-gray-100 dark:bg-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800'}`}>{getHeaderTitle()}</button>
            <button onClick={() => handleNavigate('next')} className="p-2 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"><ChevronRight size={18}/></button>
          </div>
          {isDateDropdownOpen && (
            <div className="absolute top-14 left-0 w-72 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 animate-enter z-10 origin-top-left">
              {renderHeaderDateContent()}
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-zinc-800"><button onClick={() => { setCurrentDate(new Date()); setIsDateDropdownOpen(false); }} className="w-full py-2 text-xs font-bold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl">Torna a Oggi</button></div>
            </div>
          )}
          <div className="flex p-1 bg-gray-200 dark:bg-zinc-900 rounded-xl">
              {['week', 'month', 'year'].map((m) => (<button key={m} onClick={() => setViewMode(m)} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${viewMode === m ? 'bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-white' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300'}`}>{{week: 'Sett', month: 'Mese', year: 'Anno'}[m]}</button>))}
          </div>
        </div>
        <div className="flex items-center gap-3 hidden sm:flex">
          <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-600 hover:text-black dark:hover:text-white transition-colors">
            <Settings size={16} /> <span>Account</span>
          </button>
          <div className="w-px h-6 bg-gray-200 dark:bg-zinc-800 mx-2"></div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 rounded-full shadow-sm border bg-white border-gray-100 text-gray-600 hover:bg-gray-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-white">{isDarkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button onClick={() => supabase.auth.signOut()} className="p-3 rounded-full shadow-sm border bg-white border-gray-100 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-red-900/30"><LogOut size={18} /></button>
        </div>
      </header>

      <Gantt 
        currentDate={currentDate} 
        setCurrentDate={setCurrentDate} 
        viewMode={viewMode} 
        activities={activities} 
        onUpdateActivity={handleUpdateActivityDrag}
        onEditActivity={openEditModal} 
        onDateLongPress={openNewModal} 
      />

      <button onClick={() => openNewModal(new Date())} className="fixed bottom-8 right-8 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-90 transition-all z-50 bg-black text-white dark:bg-white dark:text-black dark:shadow-[0_0_40px_rgba(255,255,255,0.2)]"><Plus size={32} /></button>

      {/* MODAL ATTIVITÀ (CREA/MODIFICA) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="absolute inset-0 backdrop-blur-md bg-black/20 dark:bg-black/60" onClick={() => setIsModalOpen(false)} />
          <div className="w-full max-w-sm rounded-[2rem] p-6 space-y-6 shadow-2xl animate-enter relative z-10 card-theme overflow-hidden">
            {showDeleteConfirm ? (
              <div className="space-y-6 text-center animate-enter">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto text-red-500 mb-2"><Trash2 size={40} /></div>
                <div><h3 className="text-xl font-bold dark:text-white">Eliminare attività?</h3><p className="text-gray-500 dark:text-zinc-400 mt-2 text-sm font-medium">Questa azione è irreversibile.</p></div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button onClick={() => setShowDeleteConfirm(false)} className="font-bold py-4 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-black dark:text-white transition-colors">Annulla</button>
                  <button onClick={confirmDelete} className="font-bold py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 transition-all active:scale-95">Elimina</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center"><h3 className="text-xl font-bold tracking-tight">{formActivity.id ? 'Modifica Attività' : 'Nuova Attività'}</h3><button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700"><X size={20}/></button></div>
                <div className="space-y-4">
                  <input autoFocus type="text" placeholder="Titolo attività..." className="modal-input" value={formActivity.title} onChange={e => setFormActivity({...formActivity, title: e.target.value})} />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 relative"><span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 pl-2">Inizio</span><button onClick={() => { setActiveDatePicker(activeDatePicker === 'start' ? null : 'start'); setPickerDate(formActivity.start); }} className={`w-full bg-gray-100 dark:bg-zinc-800 rounded-2xl p-4 text-left text-sm font-bold flex items-center justify-between transition-all ${activeDatePicker === 'start' ? 'ring-2 ring-black dark:ring-white' : ''}`}>{format(formActivity.start, 'd MMM yyyy', {locale:it})}<Calendar size={16} className="text-gray-400"/></button></div>
                    <div className="space-y-1 relative"><span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 pl-2">Fine</span><button onClick={() => { setActiveDatePicker(activeDatePicker === 'end' ? null : 'end'); setPickerDate(formActivity.end); }} className={`w-full bg-gray-100 dark:bg-zinc-800 rounded-2xl p-4 text-left text-sm font-bold flex items-center justify-between transition-all ${activeDatePicker === 'end' ? 'ring-2 ring-black dark:ring-white' : ''}`}>{format(formActivity.end, 'd MMM yyyy', {locale:it})}<Calendar size={16} className="text-gray-400"/></button></div>
                  </div>
                  {activeDatePicker ? renderCustomCalendar(activeDatePicker) : (<div className="grid grid-cols-6 gap-3 pt-2">{COLORS.map(c => (<button key={c.class} onClick={() => setFormActivity({...formActivity, color: c.class})} className={`w-10 h-10 rounded-full border-2 border-transparent transition-all ${c.class} ${formActivity.color === c.class ? 'scale-110 ring-2 ring-black dark:ring-white border-white dark:border-black' : 'hover:scale-105 opacity-80 hover:opacity-100'}`} />))}</div>)}
                </div>
                <div className="flex gap-3 pt-2"><button onClick={handleSaveActivity} className="flex-1 font-bold py-5 rounded-2xl shadow-xl active:scale-95 transition-all text-lg bg-black text-white dark:bg-white dark:text-black">{formActivity.id ? 'Salva Modifiche' : 'Crea Attività'}</button>{formActivity.id && (<button onClick={() => setShowDeleteConfirm(true)} className="w-16 flex items-center justify-center rounded-2xl bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 active:scale-95 transition-colors"><Trash2 size={24} /></button>)}</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL IMPOSTAZIONI ACCOUNT */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 backdrop-blur-md bg-black/40 dark:bg-black/80" onClick={() => setIsSettingsOpen(false)} />
            <div className="w-full max-w-md rounded-[2rem] p-8 space-y-8 shadow-2xl animate-enter relative z-10 card-theme overflow-hidden">
                <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-bold tracking-tight flex items-center gap-2"><User size={24}/> Impostazioni Account</h3>
                    <button onClick={() => setIsSettingsOpen(false)} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"><X size={20}/></button>
                </div>

                <div className="space-y-6">
                    <div className="p-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-zinc-700 rounded-full flex items-center justify-center"><Mail size={20}/></div>
                        <div>
                            <p className="text-xs font-bold uppercase text-gray-400 tracking-wider">La tua email</p>
                            <p className="font-medium truncate">{session.user.email}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                         <label className="text-sm font-bold ml-1">Cambia Email</label>
                         <div className="flex gap-2">
                             <input type="email" placeholder="Nuova email..." className="flex-1 modal-input text-sm py-3" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                             <button onClick={handleUpdateEmail} disabled={loadingSettings} className="px-4 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm hover:opacity-80 disabled:opacity-50">Aggiorna</button>
                         </div>
                    </div>

                    <hr className="border-gray-100 dark:border-zinc-800"/>

                    <div className="space-y-2">
                         <label className="text-sm font-bold ml-1 flex items-center gap-2"><Lock size={14}/> Cambia Password</label>
                         <div className="flex gap-2">
                             <input type="password" placeholder="Nuova password..." className="flex-1 modal-input text-sm py-3" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                             <button onClick={handleUpdatePassword} disabled={loadingSettings} className="px-4 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm hover:opacity-80 disabled:opacity-50">Salva</button>
                         </div>
                    </div>

                    <hr className="border-gray-100 dark:border-zinc-800"/>

                    <div className="pt-2">
                        <button onClick={requestDeleteAccount} className="w-full py-4 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/10 dark:text-red-500 dark:hover:bg-red-900/20 font-bold flex items-center justify-center gap-2 transition-colors">
                            <AlertTriangle size={20}/> Elimina Account
                        </button>
                        <p className="text-[10px] text-center text-gray-400 mt-2">Cancellazione irreversibile di tutti i dati.</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- NUOVO: MODALE CONFERMA CANCELLAZIONE ACCOUNT (Apple Style) --- */}
      {isDeleteAccountConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 backdrop-blur-md bg-black/50" onClick={() => setIsDeleteAccountConfirmOpen(false)} />
          <div className="w-full max-w-xs bg-white dark:bg-[#1C1C1E] rounded-[2rem] p-6 shadow-2xl animate-enter relative z-20 text-center space-y-4">
             <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto text-red-500">
               <AlertTriangle size={32} />
             </div>
             <div>
               <h3 className="text-lg font-bold dark:text-white">Sei davvero sicuro?</h3>
               <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                 Stai per cancellare tutto il tuo account. Non potrai più tornare indietro.
               </p>
             </div>
             <div className="grid grid-cols-2 gap-3 pt-2">
               <button onClick={() => setIsDeleteAccountConfirmOpen(false)} className="py-3 rounded-xl font-bold bg-gray-100 dark:bg-zinc-800 text-black dark:text-white">Annulla</button>
               <button onClick={handleDeleteAccountReal} className="py-3 rounded-xl font-bold bg-red-500 text-white shadow-lg shadow-red-500/30">Addio</button>
             </div>
          </div>
        </div>
      )}

      {/* --- NUOVO: ALERT GENERICO (Apple Style) --- */}
      {customAlert && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 backdrop-blur-md bg-black/20" onClick={() => setCustomAlert(null)} />
          <div className="w-full max-w-xs bg-white dark:bg-[#1C1C1E] rounded-[2rem] p-6 shadow-2xl animate-enter relative z-20 text-center space-y-4">
             <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${customAlert.type === 'error' ? 'bg-red-100 text-red-500 dark:bg-red-900/20' : 'bg-green-100 text-green-500 dark:bg-green-900/20'}`}>
               {customAlert.type === 'error' ? <AlertCircle size={32} /> : <CheckCircle size={32} />}
             </div>
             <div>
               <h3 className="text-lg font-bold dark:text-white">{customAlert.title}</h3>
               <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                 {customAlert.message}
               </p>
             </div>
             <button onClick={() => setCustomAlert(null)} className="w-full py-3 rounded-xl font-bold bg-black text-white dark:bg-white dark:text-black shadow-xl">
               Ho capito
             </button>
          </div>
        </div>
      )}

    </div>
  );
}