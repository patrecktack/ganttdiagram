import React, { useEffect, useRef, useMemo } from 'react';
import { 
  format, addDays, startOfWeek, eachDayOfInterval, 
  isSameDay, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, eachMonthOfInterval 
} from 'date-fns';
import { it } from 'date-fns/locale';
import interact from 'interactjs';

export default function Gantt({ currentDate, viewMode, activities, onUpdateActivity, onEditActivity, onDateLongPress }) {
  const scrollContainerRef = useRef(null);

  // LOGICA DATE E COLONNE
  const { days, columnWidth, timeHeader } = useMemo(() => {
    let start, end, daysInterval;
    let colWidth = 60; // Default

    if (viewMode === 'week') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = addDays(start, 6);
      colWidth = 100 / 7; 
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
    } else if (viewMode === 'month') {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
      daysInterval = eachDayOfInterval({ start, end });
      colWidth = 100 / daysInterval.length;
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
    } else {
      // Vista ANNO
      start = startOfYear(currentDate);
      end = endOfYear(currentDate);
      const months = eachMonthOfInterval({ start, end });
      return { 
        days: months, 
        columnWidth: 100 / 12, 
        timeHeader: months.map(m => ({ label: format(m, 'MMM', {locale: it}), sub: format(m, 'yyyy'), fullDate: m })) 
      };
    }
  }, [currentDate, viewMode]);

  // CONFIGURAZIONE GESTURE (INTERACT.JS)
  useEffect(() => {
    const interactable = interact('.draggable-task').draggable({
      inertia: true,
      autoScroll: true,
      hold: 150, // Ritardo per attivare il drag su mobile
      modifiers: [
        interact.modifiers.restrictRect({
          restriction: 'parent',
          endOnly: true
        })
      ],
      listeners: {
        move(event) {
          const target = event.target;
          const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
          target.style.transform = `translateX(${x}px)`;
          target.setAttribute('data-x', x);
          target.style.zIndex = "50"; 
          target.style.boxShadow = "0 10px 25px -5px rgba(0, 0, 0, 0.5)"; // Ombra più forte durante il trascinamento
        },
        end(event) {
          const target = event.target;
          const x = parseFloat(target.getAttribute('data-x')) || 0;
          
          const containerWidth = scrollContainerRef.current.offsetWidth;
          const pxPerUnit = containerWidth * (columnWidth / 100);
          const unitsMoved = Math.round(x / pxPerUnit);

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
          target.style.boxShadow = "";
        }
      }
    });

    return () => interactable.unset();
  }, [activities, columnWidth, viewMode, onUpdateActivity]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col select-none relative bg-white dark:bg-black">
      {/* HEADER DATE */}
      <div className="flex border-b border-gray-200 dark:border-zinc-700 bg-gray-50/90 dark:bg-zinc-900/90 backdrop-blur-sm z-20">
        {timeHeader.map((item, i) => (
          <div 
            key={i} 
            style={{ width: `${columnWidth}%` }} 
            className={`flex-shrink-0 py-3 border-r border-gray-200 dark:border-zinc-700 text-center flex flex-col justify-center min-w-[40px] ${item.isToday ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-400">
              {item.label}
            </span>
            <span className={`text-sm font-bold mt-0.5 ${item.isToday ? 'text-blue-600 dark:text-blue-400 scale-110' : 'text-gray-700 dark:text-zinc-200'}`}>
              {item.sub}
            </span>
          </div>
        ))}
      </div>

      {/* AREA SCROLLABILE - GRIGLIA */}
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden touch-pan-y" ref={scrollContainerRef}>
        
        {/* GRIGLIA DI SFONDO (Righe verticali più visibili) */}
        <div className="absolute inset-0 flex h-full">
          {days.map((_, i) => (
            <div 
              key={i} 
              style={{ width: `${columnWidth}%` }} 
              // QUI LA MODIFICA: dark:border-zinc-700 invece di 800/30 per maggiore visibilità
              className="flex-shrink-0 border-r border-gray-200 dark:border-zinc-700 h-full hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
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
                    left: `${(days.findIndex(d => isSameDay(d, new Date())) * columnWidth) + (columnWidth/2)}%` 
                }}
             />
        )}

        {/* ATTIVITÀ RENDERIZZATE */}
        <div className="relative min-h-full py-6 pb-24">
          {activities.map((activity, index) => {
            const startOfView = days[0];
            const endOfView = days[days.length - 1];
            
            if (activity.start > endOfView || addDays(activity.start, activity.days) < startOfView) return null;

            let startIndex, widthVal;
            if (viewMode === 'year') {
                 startIndex = days.findIndex(d => d.getMonth() === activity.start.getMonth() && d.getFullYear() === activity.start.getFullYear());
                 widthVal = (activity.days / 30) * columnWidth; 
            } else {
                 startIndex = days.findIndex(d => isSameDay(d, activity.start));
                 widthVal = activity.days * columnWidth;
            }

            let leftPos = startIndex !== -1 ? startIndex * columnWidth : 0;
            if (startIndex === -1 && activity.start < startOfView) {
                 const diffDays = Math.ceil((startOfView - activity.start) / (1000 * 60 * 60 * 24));
                 widthVal -= (diffDays * columnWidth);
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
      {/* BARRA IN FONDO RIMOSSA COMPLETAMENTE */}
    </div>
  );
}