import React, { useEffect, useRef, useMemo } from 'react';
import { 
  format, addDays, startOfWeek, eachDayOfInterval, 
  isSameDay, isSameMonth, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, eachMonthOfInterval, addMonths
} from 'date-fns';
import { it } from 'date-fns/locale';
import interact from 'interactjs';

export default function Gantt({ currentDate, viewMode, activities, onUpdateActivity, onEditActivity, onDateLongPress }) {
  const scrollContainerRef = useRef(null);

  // --- LOGICA DI CALCOLO DATE (Ripristinata completa) ---
  const { days, columnWidth, timeHeader } = useMemo(() => {
    let start, end, daysInterval;
    let colWidth = 60; // Default per mobile/settimana

    if (viewMode === 'week') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = addDays(start, 6);
      colWidth = 100 / 7; 
    } else if (viewMode === 'month') {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
      colWidth = 100 / (eachDayOfInterval({ start, end }).length);
    } else {
      start = startOfYear(currentDate);
      end = endOfYear(currentDate);
      // Per la vista anno mostriamo i mesi invece dei giorni per non esplodere
      const months = eachMonthOfInterval({ start, end });
      return { 
        days: months, 
        columnWidth: 100 / 12, 
        timeHeader: months.map(m => ({ label: format(m, 'MMM', {locale: it}), sub: format(m, 'yyyy') })) 
      };
    }

    daysInterval = eachDayOfInterval({ start, end });
    return {
      days: daysInterval,
      columnWidth: colWidth,
      timeHeader: daysInterval.map(d => ({ 
        label: format(d, 'EEE', {locale: it}), 
        sub: format(d, 'd'),
        isToday: isSameDay(d, new Date()),
        fullDate: d
      }))
    };
  }, [currentDate, viewMode]);

  // --- GESTIONE DRAG & DROP (MOBILE + DESKTOP) ---
  useEffect(() => {
    const interactable = interact('.draggable-task').draggable({
      inertia: true,
      autoScroll: true,
      // Supporto Gesture: attiviamo il trascinamento solo dopo una piccola pressione su mobile
      hold: 150, 
      listeners: {
        move(event) {
          const target = event.target;
          const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
          target.style.transform = `translateX(${x}px)`;
          target.setAttribute('data-x', x);
          target.style.zIndex = "100";
        },
        end(event) {
          const target = event.target;
          const x = parseFloat(target.getAttribute('data-x')) || 0;
          
          // Calcolo dello spostamento in base alla larghezza delle colonne
          const containerWidth = scrollContainerRef.current.offsetWidth;
          const dayWidth = containerWidth * (columnWidth / 100);
          const daysMoved = Math.round(x / dayWidth);

          const activityId = target.getAttribute('data-id');
          const activity = activities.find(a => String(a.id) === String(activityId));

          if (activity && daysMoved !== 0) {
            const newStart = addDays(new Date(activity.start), daysMoved);
            onUpdateActivity({ ...activity, start: newStart });
          }

          // Reset temporaneo in attesa del re-render di React da Supabase
          target.style.transform = 'none';
          target.setAttribute('data-x', 0);
          target.style.zIndex = "10";
        }
      }
    });

    return () => interactable.unset();
  }, [activities, columnWidth, viewMode, onUpdateActivity]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-black select-none">
      {/* HEADER TEMPORALE */}
      <div className="flex border-b dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 backdrop-blur-md">
        {timeHeader.map((item, i) => (
          <div 
            key={i} 
            style={{ width: `${columnWidth}%` }} 
            className={`flex-shrink-0 py-3 border-r dark:border-zinc-800 text-center flex flex-col justify-center min-w-[40px] ${item.isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
          >
            <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400 dark:text-zinc-500">
              {item.label}
            </span>
            <span className={`text-sm font-bold ${item.isToday ? 'text-blue-500' : 'text-gray-700 dark:text-zinc-200'}`}>
              {item.sub}
            </span>
          </div>
        ))}
      </div>

      {/* AREA DEL DIAGRAMMA */}
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden touch-pan-y" ref={scrollContainerRef}>
        
        {/* GRIGLIA DI SFONDO */}
        <div className="absolute inset-0 flex">
          {days.map((_, i) => (
            <div 
              key={i} 
              style={{ width: `${columnWidth}%` }} 
              className="flex-shrink-0 border-r border-gray-100 dark:border-zinc-900/30 h-full"
              onDoubleClick={() => onDateLongPress(days[i])}
              // Gesture Mobile: Tocco lungo per creare attività
              onTouchStart={(e) => {
                const timer = setTimeout(() => onDateLongPress(days[i]), 700);
                e.target.ontouchend = () => clearTimeout(timer);
              }}
            />
          ))}
        </div>

        {/* ATTIVITÀ (BARRE) */}
        <div className="relative min-h-full py-6">
          {activities.map((activity, index) => {
            const startOfView = days[0];
            const endOfView = days[days.length - 1];
            
            // Calcolo posizione
            if (activity.start > endOfView || addDays(activity.start, activity.days) < startOfView) return null;

            const startIndex = days.findIndex(d => isSameDay(d, activity.start));
            const leftPos = startIndex !== -1 ? startIndex * columnWidth : 0;
            
            // Gestione attività che iniziano prima della visualizzazione corrente
            let displayDays = activity.days;
            if (startIndex === -1) {
                const diff = Math.ceil((startOfView - activity.start) / (1000 * 60 * 60 * 24));
                displayDays = Math.max(0, activity.days - diff);
            }

            return (
              <div
                key={activity.id}
                data-id={activity.id}
                onClick={() => onEditActivity(activity)}
                className={`draggable-task absolute h-11 mb-2 rounded-2xl flex items-center px-4 shadow-sm border-2 border-white/10 cursor-pointer transition-shadow hover:shadow-lg active:scale-[0.98] touch-none ${activity.color}`}
                style={{
                  left: `${leftPos}%`,
                  width: `${displayDays * columnWidth}%`,
                  top: `${index * 56 + 20}px`,
                  zIndex: 10,
                }}
              >
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[11px] font-black truncate leading-tight uppercase tracking-tight">
                    {activity.title}
                  </span>
                  {viewMode !== 'year' && (
                    <span className="text-[9px] opacity-70 font-bold truncate">
                      {activity.days} {activity.days === 1 ? 'giorno' : 'giorni'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER STATISTICHE (Stile Apple) */}
      <div className="p-3 border-t dark:border-zinc-800 bg-white dark:bg-black flex justify-between items-center px-6">
          <div className="flex gap-4">
            <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Attività</span>
                <span className="text-sm font-black dark:text-white">{activities.length}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Vista</span>
                <span className="text-sm font-black dark:text-white capitalize">{viewMode}</span>
            </div>
          </div>
          <div className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full uppercase tracking-tighter">
            Gestures Attive
          </div>
      </div>
    </div>
  );
}