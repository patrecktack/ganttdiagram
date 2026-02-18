import React, { useEffect, useRef, useMemo, useLayoutEffect, useState } from 'react';
import { 
  format, addDays, startOfWeek, eachDayOfInterval, 
  isSameDay, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, eachMonthOfInterval 
} from 'date-fns';
import { it } from 'date-fns/locale';
import interact from 'interactjs';

// Larghezza fissa colonne = STABILITÀ
const COLUMN_WIDTH = 60; 

export default function Gantt({ currentDate = new Date(), viewMode = 'month', activities = [], onUpdateActivity, onEditActivity, onDateLongPress, onNavigate }) {
  const containerRef = useRef(null);
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const lastNavDirection = useRef('next');

  // --- 1. CALCOLO GRIGLIA ---
  const { days, timeHeader, totalWidth } = useMemo(() => {
    let start, end, daysInterval;
    const safeDate = currentDate || new Date(); 

    if (viewMode === 'week') {
      start = startOfWeek(safeDate, { weekStartsOn: 1 });
      end = addDays(start, 6);
      daysInterval = eachDayOfInterval({ start, end });
    } else if (viewMode === 'month') {
      start = startOfMonth(safeDate);
      end = endOfMonth(safeDate);
      daysInterval = eachDayOfInterval({ start, end });
    } else {
      start = startOfYear(safeDate);
      end = endOfYear(safeDate);
      const months = eachMonthOfInterval({ start, end });
      return { 
        days: months,
        timeHeader: months.map(m => ({ 
          label: format(m, 'MMM', {locale: it}), 
          sub: format(m, 'yyyy'), 
          isToday: false,
          date: m
        })),
        totalWidth: months.length * COLUMN_WIDTH 
      };
    }

    const header = daysInterval.map(d => ({ 
      label: format(d, 'EEE', {locale: it}), 
      sub: format(d, 'd'),
      isToday: isSameDay(d, new Date()),
      date: d
    }));

    return { 
      days: daysInterval, 
      timeHeader: header, 
      totalWidth: daysInterval.length * COLUMN_WIDTH 
    };
  }, [currentDate, viewMode]);

  // --- 2. RESET SCROLL ---
  useLayoutEffect(() => {
    if (containerRef.current) {
        containerRef.current.style.scrollBehavior = 'auto'; // Disabilita animazioni
        if (lastNavDirection.current === 'prev') {
            containerRef.current.scrollLeft = containerRef.current.scrollWidth;
        } else {
            containerRef.current.scrollLeft = 0;
        }
        lastNavDirection.current = 'next';
    }
  }, [currentDate, viewMode]);

  // --- 3. MOUSE GRAB (SFONDO) ---
  const handleMouseDown = (e) => {
    // FONDAMENTALE: Se clicco su un task, NON avviare il grab dello sfondo.
    if (e.target.closest('.draggable-task')) return;
    
    dragRef.current.isDown = true;
    dragRef.current.startX = e.pageX - containerRef.current.offsetLeft;
    dragRef.current.scrollLeft = containerRef.current.scrollLeft;
    containerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseUp = () => {
    dragRef.current.isDown = false;
    if(containerRef.current) containerRef.current.style.cursor = 'grab';
  };

  const handleMouseMove = (e) => {
    if (!dragRef.current.isDown) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - dragRef.current.startX) * 1.5; // Velocità
    
    // Aggiorno direttamente lo scroll (No Lag)
    containerRef.current.scrollLeft = dragRef.current.scrollLeft - walk;
  };

  // --- 4. SCROLL LISTENER (Per caricare mesi) ---
  const handleScroll = () => {
    if (!containerRef.current || !onNavigate) return;
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    
    if (Math.ceil(scrollLeft + clientWidth) >= scrollWidth - 2) {
       onNavigate('next'); 
       lastNavDirection.current = 'next';
    } 
  };

  // --- 5. INTERACT.JS (DRAG TASK) ---
  useEffect(() => {
    if (!containerRef.current) return;

    // Reset interact
    interact('.draggable-task').unset();

    const interactable = interact('.draggable-task').draggable({
      inertia: true,
      autoScroll: {
        container: containerRef.current,
        margin: 50,
        speed: 300
      },
      modifiers: [ interact.modifiers.restrictRect({ restriction: 'parent', endOnly: true }) ],
      listeners: {
        start(event) {
           event.target.style.opacity = '0.8';
           event.target.style.zIndex = '50';
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
          const unitsMoved = Math.round(x / COLUMN_WIDTH);
          const activityId = target.getAttribute('data-id');
          
          if (activities) {
            const activity = activities.find(a => String(a.id) === String(activityId));
            if (activity && unitsMoved !== 0) {
                let newStart;
                if (viewMode === 'year') {
                    newStart = addDays(new Date(activity.start), unitsMoved * 30);
                } else {
                    newStart = addDays(new Date(activity.start), unitsMoved);
                }
                if (onUpdateActivity) onUpdateActivity({ ...activity, start: newStart });
            }
          }

          target.style.transform = 'none';
          target.setAttribute('data-x', 0);
          target.style.zIndex = '20';
          target.style.opacity = '1';
        }
      }
    });
    return () => interactable.unset();
  }, [activities, viewMode, onUpdateActivity]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-black relative select-none w-full h-full">
      <div 
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative cursor-grab active:cursor-grabbing"
        style={{ scrollBehavior: 'smooth', overscrollBehaviorX: 'none' }} 
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        onScroll={handleScroll}
      >
        <div className="relative h-full flex" style={{ width: `${totalWidth}px`, minWidth: '100%' }}>
          {days.map((day, i) => (
             <div 
                key={i} 
                className="flex-shrink-0 h-full border-r border-gray-100 dark:border-zinc-800 relative group bg-white dark:bg-black"
                style={{ width: `${COLUMN_WIDTH}px` }}
                onDoubleClick={() => onDateLongPress && onDateLongPress(day)}
                onTouchStart={(e) => {
                    if(onDateLongPress) {
                        const timer = setTimeout(() => onDateLongPress(day), 600);
                        e.target.ontouchend = () => clearTimeout(timer);
                    }
                }}
             >
                <div className="h-14 border-b border-gray-100 dark:border-zinc-800 bg-white/95 dark:bg-black/95 flex flex-col justify-center items-center sticky top-0 z-30 pointer-events-none select-none">
                    <span className="text-[10px] font-black uppercase text-gray-400 dark:text-zinc-500 tracking-wider">
                        {timeHeader[i]?.label}
                    </span>
                    <span className={`text-sm font-bold mt-0.5 ${timeHeader[i]?.isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-zinc-300'}`}>
                        {timeHeader[i]?.sub}
                    </span>
                </div>
                <div className="absolute inset-0 top-14 hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 pointer-events-none transition-colors" />
             </div>
          ))}

          <div className="flex-shrink-0 w-40 h-full border-r border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex items-center justify-center">
             <span className="text-xs text-gray-400 rotate-90 whitespace-nowrap">Carico...</span>
          </div>

          {viewMode !== 'year' && days.some(d => isSameDay(d, new Date())) && (
             <div 
                className="absolute top-14 bottom-0 border-l-2 border-blue-500 z-10 pointer-events-none opacity-50 dashed"
                style={{ left: `${(days.findIndex(d => isSameDay(d, new Date())) * COLUMN_WIDTH) + (COLUMN_WIDTH/2)}px` }}
             />
          )}

          <div className="absolute top-14 left-0 right-0 bottom-0 pointer-events-none">
             <div className="relative w-full h-full">
                {activities && activities.map((activity, index) => {
                  const startIdx = viewMode === 'year' 
                    ? days.findIndex(d => d.getMonth() === activity.start.getMonth() && d.getFullYear() === activity.start.getFullYear())
                    : days.findIndex(d => isSameDay(d, activity.start));
                  
                  if (startIdx === -1 && activity.start > days[days.length-1]) return null;

                  let left = startIdx * COLUMN_WIDTH;
                  let width = (viewMode === 'year' ? activity.days / 30 : activity.days) * COLUMN_WIDTH;

                  if (startIdx === -1 && activity.start < days[0]) {
                     const diff = Math.ceil((days[0] - activity.start) / (1000 * 60 * 60 * 24));
                     width -= diff * COLUMN_WIDTH;
                     left = 0;
                  }
                  if (width <= 0) return null;

                  return (
                    <div
                      key={activity.id}
                      data-id={activity.id}
                      // IMPORTANTE: pointer-events-auto qui ferma il grab dello sfondo
                      className={`draggable-task absolute h-10 mb-2 rounded-xl flex items-center px-3 shadow-sm border border-white/10 pointer-events-auto cursor-grab active:cursor-grabbing hover:brightness-110 touch-none ${activity.color}`}
                      onClick={(e) => { e.stopPropagation(); onEditActivity && onEditActivity(activity); }}
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        top: `${index * 50 + 10}px`,
                        zIndex: 20,
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
    </div>
  );
}