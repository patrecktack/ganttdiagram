import React, { useEffect, useRef, useMemo } from 'react';
import { 
  format, addDays, startOfWeek, eachDayOfInterval, 
  isSameDay, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, eachMonthOfInterval 
} from 'date-fns';
import { it } from 'date-fns/locale';
import interact from 'interactjs';

export default function Gantt({ currentDate, viewMode, activities, onUpdateActivity, onEditActivity, onDateLongPress }) {
  // Container principale per lo scroll (X e Y unificati)
  const mainScrollRef = useRef(null);

  // LOGICA DATE
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
      // Vista ANNO
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

  // CONFIGURAZIONE GESTURE (INTERACT.JS)
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
      modifiers: [
        interact.modifiers.restrictRect({
          restriction: 'parent', // Restringe al contenitore scrollabile interno
          endOnly: true
        })
      ],
      listeners: {
        start(event) {
           event.target.style.opacity = '0.8';
           event.target.style.zIndex = '100';
           event.target.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.5)';
        },
        move(event) {
          const target = event.target;
          const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
          target.style.transform = `translateX(${x}px)`;
          target.setAttribute('data-x', x);
        },
        end(event) {
          const target = event.target;
          const x = parseFloat(target.getAttribute('data-x')) || 0;
          
          // --- CALCOLO SPOSTAMENTO BASATO SU PIXEL REALI ---
          // Recuperiamo la larghezza di una singola colonna direttamente dal DOM per precisione assoluta
          const dayColumn = mainScrollRef.current.querySelector('.day-column');
          const colWidthPx = dayColumn ? dayColumn.offsetWidth : 50; // Fallback
          
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

          // Reset visivo
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

  // Calcolo larghezza minima contenitore per forzare lo scroll su mobile
  // 50px minimo per colonna su mobile, altrimenti fit (100%)
  const minWidthStyle = { minWidth: `${Math.max(100, totalDays * 12)}%` }; // Su mobile sarà tipo 300%

  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-black select-none relative" ref={mainScrollRef}>
      {/* WRAPPER CHE SI ESPANDE ORIZZONTALMENTE */}
      <div className="flex flex-col h-full" style={minWidthStyle}>
        
        {/* HEADER STICKY (Resta in alto mentre scorri le attività) */}
        <div className="sticky top-0 z-40 flex border-b border-gray-200 dark:border-zinc-800 bg-gray-50/95 dark:bg-zinc-900/95 backdrop-blur-sm shadow-sm">
          {timeHeader.map((item, i) => (
            <div 
              key={i} 
              // Larghezza dinamica basata sul numero di giorni (es. 1/30)
              style={{ width: `${100 / totalDays}%` }}
              className={`flex-shrink-0 py-3 border-r border-gray-200 dark:border-zinc-800/50 text-center flex flex-col justify-center min-w-[40px] ${item.isToday ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
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

        {/* AREA GRIGLIA E ATTIVITÀ */}
        <div className="relative flex-1 min-h-[500px]"> {/* min-h assicura scroll verticale se vuoto */}
          
          {/* GRIGLIA DI SFONDO */}
          <div className="absolute inset-0 flex h-full">
            {days.map((_, i) => (
              <div 
                key={i} 
                style={{ width: `${100 / totalDays}%` }}
                className="day-column flex-shrink-0 border-r border-gray-100 dark:border-zinc-800 h-full hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors"
                onDoubleClick={() => onDateLongPress(days[i])}
                onTouchStart={(e) => {
                    const timer = setTimeout(() => onDateLongPress(days[i]), 600);
                    e.target.ontouchend = () => clearTimeout(timer);
                }}
              />
            ))}
          </div>

          {/* LINEA GIORNO CORRENTE */}
          {viewMode !== 'year' && days.some(d => isSameDay(d, new Date())) && (
              <div 
                  className="absolute top-0 bottom-0 border-l-2 border-blue-500 z-0 pointer-events-none opacity-50 dashed"
                  style={{ 
                      left: `${(days.findIndex(d => isSameDay(d, new Date())) * (100 / totalDays)) + ((100 / totalDays)/2)}%` 
                  }}
              />
          )}

          {/* ATTIVITÀ */}
          <div className="relative pt-6 pb-24">
            {activities.map((activity, index) => {
              const startOfView = days[0];
              const endOfView = days[days.length - 1];
              
              if (activity.start > endOfView || addDays(activity.start, activity.days) < startOfView) return null;

              let startIndex, widthVal;
              const colPercentage = 100 / totalDays;

              if (viewMode === 'year') {
                  startIndex = days.findIndex(d => d.getMonth() === activity.start.getMonth() && d.getFullYear() === activity.start.getFullYear());
                  widthVal = (activity.days / 30) * colPercentage; 
              } else {
                  startIndex = days.findIndex(d => isSameDay(d, activity.start));
                  widthVal = activity.days * colPercentage;
              }

              let leftPos = startIndex !== -1 ? startIndex * colPercentage : 0;
              // Gestione attività che iniziano prima della vista
              if (startIndex === -1 && activity.start < startOfView) {
                  const diffDays = Math.ceil((startOfView - activity.start) / (1000 * 60 * 60 * 24));
                  widthVal -= (diffDays * colPercentage);
              }
              if (widthVal <= 0) return null;

              return (
                <div
                  key={activity.id}
                  data-id={activity.id}
                  onClick={() => onEditActivity(activity)}
                  className={`draggable-task absolute h-10 mb-3 rounded-xl flex items-center px-3 shadow-sm border border-white/20 cursor-grab active:cursor-grabbing hover:brightness-110 transition-transform hover:scale-[1.01] touch-none ${activity.color}`}
                  style={{
                    left: `${leftPos}%`,
                    width: `${widthVal}%`,
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