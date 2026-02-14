import React, { useEffect, useRef, useMemo, useState } from 'react';
import { 
  format, addDays, startOfWeek, eachDayOfInterval, 
  isSameDay, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, eachMonthOfInterval 
} from 'date-fns';
import { it } from 'date-fns/locale';
import interact from 'interactjs';

export default function Gantt({ currentDate, viewMode, activities, onUpdateActivity, onEditActivity, onDateLongPress, onNavigate }) {
  const mainScrollRef = useRef(null);
  const [touchStart, setTouchStart] = useState(null);

  // --- 1. CALCOLO DATE ---
  const { days, timeHeader, totalDays } = useMemo(() => {
    let start, end, daysInterval;

    if (viewMode === 'week') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = addDays(start, 6);
      daysInterval = eachDayOfInterval({ start, end });
      return {
        days: daysInterval,
        totalDays: 7,
        timeHeader: daysInterval.map(d => ({ 
          label: format(d, 'EEE', {locale: it}), 
          sub: format(d, 'd'),
          isToday: isSameDay(d, new Date()),
          fullDate: d
        }))
      };
    } else if (viewMode === 'month') {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
      daysInterval = eachDayOfInterval({ start, end });
      return {
        days: daysInterval,
        totalDays: daysInterval.length,
        timeHeader: daysInterval.map(d => ({ 
          label: format(d, 'EEE', {locale: it}), 
          sub: format(d, 'd'),
          isToday: isSameDay(d, new Date()),
          fullDate: d
        }))
      };
    } else {
      start = startOfYear(currentDate);
      end = endOfYear(currentDate);
      const months = eachMonthOfInterval({ start, end });
      return { 
        days: months, 
        totalDays: 12,
        timeHeader: months.map(m => ({ label: format(m, 'MMM', {locale: it}), sub: format(m, 'yyyy'), fullDate: m })) 
      };
    }
  }, [currentDate, viewMode]);

  // --- 2. RESET SCROLL (SEMPLICE E FUNZIONANTE) ---
  // Ogni volta che cambia la data, riporta lo scroll a sinistra (0).
  // Niente calcoli strani, niente salti alla fine.
  useEffect(() => {
    if (mainScrollRef.current) {
        mainScrollRef.current.scrollLeft = 0;
    }
  }, [currentDate, viewMode]);

  // --- 3. GESTIONE SWIPE ---
  const handleTouchStart = (e) => setTouchStart(e.targetTouches[0].clientX);
  
  const handleTouchEnd = (e) => {
      if (!touchStart) return;
      const touchEnd = e.changedTouches[0].clientX;
      const diff = touchStart - touchEnd;
      const container = mainScrollRef.current;
      
      // Calcolo se siamo a fine corsa
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      const isAtEnd = container.scrollLeft >= (maxScrollLeft - 20); // Tolleranza 20px
      const isAtStart = container.scrollLeft <= 20;

      if (Math.abs(diff) > 50) { // Swipe deciso (>50px)
          // Swipe verso SX (Next) -> Solo se sono a fine corsa
          if (diff > 0 && isAtEnd) {
              if (onNavigate) onNavigate('next');
          } 
          // Swipe verso DX (Prev) -> Solo se sono a inizio corsa
          else if (diff < 0 && isAtStart) {
              if (onNavigate) onNavigate('prev');
          }
      }
      setTouchStart(null);
  };

  // --- 4. DRAG & DROP ---
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const interactable = interact('.draggable-task').draggable({
      inertia: true,
      autoScroll: {
        container: mainScrollRef.current,
        margin: 50,
        speed: 300
      },
      hold: isMobile ? 300 : 0, 
      modifiers: [ interact.modifiers.restrictRect({ restriction: 'parent', endOnly: true }) ],
      listeners: {
        start(event) {
           event.target.style.opacity = '0.9';
           event.target.style.zIndex = '100';
           event.target.style.transform = 'scale(1.02)';
           event.target.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.5)';
        },
        move(event) {
          const target = event.target;
          const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
          target.style.transform = `translateX(${x}px) scale(1.02)`;
          target.setAttribute('data-x', x);
        },
        end(event) {
          const target = event.target;
          const x = parseFloat(target.getAttribute('data-x')) || 0;
          
          // Misura precisa della colonna
          const dayColumn = mainScrollRef.current.querySelector('.day-column');
          const colWidthPx = dayColumn ? dayColumn.getBoundingClientRect().width : 1; 
          
          const unitsMoved = Math.round(x / colWidthPx);
          const activityId = target.getAttribute('data-id');
          const activity = activities.find(a => String(a.id) === String(activityId));

          if (activity && unitsMoved !== 0) {
            let newStart;
            if (viewMode === 'year') {
                newStart = addDays(new Date(activity.start), unitsMoved * 30);
            } else {
                newStart = addDays(new Date(activity.start), unitsMoved);
            }
            onUpdateActivity({ ...activity, start: newStart });
          }

          target.style.transform = 'none';
          target.setAttribute('data-x', 0);
          target.style.zIndex = "10";
          target.style.opacity = '1';
          target.style.boxShadow = "";
        }
      }
    });

    return () => interactable.unset();
  }, [activities, viewMode, onUpdateActivity]);

  return (
    <div 
        className="flex-1 overflow-auto bg-white dark:bg-black select-none relative touch-pan-x" 
        ref={mainScrollRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
    >
      {/* WRAPPER: Qui sta la correzione per il desktop.
          Invece di "w-full", usiamo "min-w-max". 
          Questo costringe il contenitore a essere largo quanto la somma delle colonne (50px * 30 = 1500px).
          Quindi scrollerà SEMPRE, anche su desktop.
      */}
      <div className="flex flex-col h-full min-w-max">
        
        {/* HEADER STICKY */}
        <div className="sticky top-0 z-40 flex border-b border-gray-200 dark:border-zinc-800 bg-gray-50/95 dark:bg-zinc-900/95 backdrop-blur-sm shadow-sm">
          {timeHeader.map((item, i) => (
            <div 
              key={i} 
              // LARGHEZZA FISSA 50px PER TUTTI. Niente più adattamenti strani.
              className="flex-shrink-0 w-[50px] py-3 border-r border-gray-200 dark:border-zinc-800/50 text-center flex flex-col justify-center"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                {item.label}
              </span>
              <span className={`text-sm font-bold mt-0.5 ${item.isToday ? 'text-blue-600 dark:text-blue-400 scale-110' : 'text-gray-700 dark:text-zinc-300'}`}>
                {item.sub}
              </span>
            </div>
          ))}
        </div>

        {/* AREA GRIGLIA */}
        <div className="relative flex-1 min-h-[500px]">
          
          <div className="absolute inset-0 flex h-full">
            {days.map((_, i) => (
              <div 
                key={i} 
                className="day-column flex-shrink-0 w-[50px] border-r border-gray-100 dark:border-zinc-800 h-full hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors"
                onDoubleClick={() => onDateLongPress(days[i])}
                onTouchStart={(e) => {
                    const timer = setTimeout(() => onDateLongPress(days[i]), 600);
                    e.target.ontouchend = () => clearTimeout(timer);
                }}
              />
            ))}
          </div>

          {/* LINEA OGGI */}
          {viewMode !== 'year' && days.some(d => isSameDay(d, new Date())) && (
              <div 
                  className="absolute top-0 bottom-0 border-l-2 border-blue-500 z-0 pointer-events-none opacity-50 dashed"
                  // Calcolo fisso: indice * 50px + metà colonna (25px)
                  style={{ 
                      left: `${(days.findIndex(d => isSameDay(d, new Date())) * 50) + 25}px` 
                  }}
              />
          )}

          {/* ATTIVITÀ */}
          <div className="relative pt-6 pb-24">
            {activities.map((activity, index) => {
              const startOfView = days[0];
              const endOfView = days[days.length - 1];
              
              if (activity.start > endOfView || addDays(activity.start, activity.days) < startOfView) return null;

              // CALCOLI BASATI SUI 50PX FISSI
              let startIndex;
              let widthVal;

              if (viewMode === 'year') {
                  startIndex = days.findIndex(d => d.getMonth() === activity.start.getMonth() && d.getFullYear() === activity.start.getFullYear());
                  widthVal = (activity.days / 30) * 50; 
              } else {
                  startIndex = days.findIndex(d => isSameDay(d, activity.start));
                  widthVal = activity.days * 50;
              }

              let leftPos = startIndex !== -1 ? startIndex * 50 : 0;
              
              if (startIndex === -1 && activity.start < startOfView) {
                  const diffDays = Math.ceil((startOfView - activity.start) / (1000 * 60 * 60 * 24));
                  widthVal -= (diffDays * 50);
              }
              
              if (widthVal <= 0) return null;

              return (
                <div
                  key={activity.id}
                  data-id={activity.id}
                  onClick={() => onEditActivity(activity)}
                  className={`draggable-task absolute h-10 mb-3 rounded-xl flex items-center px-3 shadow-sm border border-white/20 cursor-grab active:cursor-grabbing hover:brightness-110 transition-transform hover:scale-[1.01] touch-none ${activity.color}`}
                  style={{
                    left: `${leftPos}px`, // Pixel, non percentuali
                    width: `${widthVal}px`, // Pixel, non percentuali
                    top: `${index * 50 + 10}px`,
                    zIndex: 10,
                    minWidth: '20px'
                  }}
                >
                  <span className="text-xs font-bold truncate text-white drop-shadow-md pointer-events-none select-none">
                    {activity.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}