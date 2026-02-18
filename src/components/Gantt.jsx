import React, { useEffect, useRef, useMemo, useLayoutEffect, useState } from 'react';
import { 
  format, addDays, startOfWeek, eachDayOfInterval, 
  isSameDay, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, eachMonthOfInterval 
} from 'date-fns';
import { it } from 'date-fns/locale';
import interact from 'interactjs';

// Larghezza fissa per stabilità e calcoli precisi
const COLUMN_WIDTH = 60; 

export default function Gantt({ currentDate = new Date(), viewMode = 'month', activities = [], onUpdateActivity, onEditActivity, onDateLongPress, onNavigate }) {
  const containerRef = useRef(null);
  
  // Ref per tracciare la direzione della navigazione (per il reset dello scroll)
  const lastNavDirection = useRef('next'); 
  
  // Refs per la logica "Grab & Drag" dello sfondo
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  // 1. CALCOLO GRIGLIA E DATE
  const { days, timeHeader, totalWidth } = useMemo(() => {
    let start, end, daysInterval;
    const safeDate = currentDate || new Date(); // Protezione se currentDate è null

    if (viewMode === 'week') {
      start = startOfWeek(safeDate, { weekStartsOn: 1 });
      end = addDays(start, 6);
      daysInterval = eachDayOfInterval({ start, end });
    } else if (viewMode === 'month') {
      start = startOfMonth(safeDate);
      end = endOfMonth(safeDate);
      daysInterval = eachDayOfInterval({ start, end });
    } else {
      // Vista Anno
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

  // 2. RESET SCROLL ISTANTANEO (Per infinite scroll effect)
  useLayoutEffect(() => {
    if (containerRef.current) {
        containerRef.current.style.scrollBehavior = 'auto'; // Disabilita animazione per reset immediato
        if (lastNavDirection.current === 'prev') {
            containerRef.current.scrollLeft = containerRef.current.scrollWidth;
        } else {
            containerRef.current.scrollLeft = 0;
        }
        lastNavDirection.current = 'next'; // Reset default
    }
  }, [currentDate, viewMode]);

  // 3. LOGICA MOUSE GRAB (SPOSTAMENTO SFONDO)
  const handleMouseDown = (e) => {
    // Se l'utente clicca su un task, NON avviare il grab dello sfondo (lascia fare a interact.js)
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
    e.preventDefault(); // Evita selezione del testo
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - dragRef.current.startX) * 1.5; // Moltiplicatore velocità scroll (1.5x)
    
    // Applica lo scroll
    containerRef.current.scrollLeft = dragRef.current.scrollLeft - walk;
  };

  // 4. TRIGGER NAVIGAZIONE AI BORDI
  const handleScroll = () => {
    if (!containerRef.current || !onNavigate) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    
    // Se siamo arrivati alla fine (con piccola tolleranza)
    if (Math.ceil(scrollLeft + clientWidth) >= scrollWidth - 2) {
       onNavigate('next'); 
       lastNavDirection.current = 'next';
    } 
    // Se siamo all'inizio (puoi decommentare per navigazione indietro automatica)
    // else if (scrollLeft <= 0) {
    //    onNavigate('prev'); lastNavDirection.current = 'prev';
    // }
  };

  // 5. INTERACT.JS (SPOSTAMENTO ATTIVITÀ)
  useEffect(() => {
    if (!containerRef.current) return;

    // Pulisci istanze precedenti per sicurezza
    interact('.draggable-task').unset();

    const interactable = interact('.draggable-task').draggable({
      inertia: true,
      autoScroll: {
        container: containerRef.current,
        margin: 50,
        speed: 300
      },
      modifiers: [
        interact.modifiers.restrictRect({
          restriction: 'parent',
          endOnly: true
        })
      ],
      listeners: {
        start(event) {
           event.target.style.opacity = '0.8';
           event.target.style.zIndex = '50';
           event.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
        },
        move(event) {
          const target = event.target;
          // Usa trasformazioni CSS per performance massime
          const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
          target.style.transform = `translateX(${x}px)`;
          target.setAttribute('data-x', x);
        },
        end(event) {
          const target = event.target;
          const x = parseFloat(target.getAttribute('data-x')) || 0;
          
          // Calcolo matematico basato sulla larghezza fissa (60px)
          const unitsMoved = Math.round(x / COLUMN_WIDTH);
          const activityId = target.getAttribute('data-id');
          
          if (activities) {
            const activity = activities.find(a => String(a.id) === String(activityId));
            if (activity && unitsMoved !== 0) {
                let newStart;
                if (viewMode === 'year') {
                    newStart = addDays(new Date(activity.start), unitsMoved * 30); // Approx mese
                } else {
                    newStart = addDays(new Date(activity.start), unitsMoved);
                }
                if (onUpdateActivity) onUpdateActivity({ ...activity, start: newStart });
            }
          }

          // Reset visivo
          target.style.transform = 'none';
          target.setAttribute('data-x', 0);
          target.style.zIndex = '20';
          target.style.opacity = '1';
          target.style.boxShadow = 'none';
        }
      }
    });

    return () => interactable.unset();
  }, [activities, viewMode, onUpdateActivity]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-black relative select-none w-full h-full">
      
      {/* AREA SCROLLABILE PRINCIPALE */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative cursor-grab active:cursor-grabbing"
        // overscroll-none: Blocca l'effetto rimbalzo/bianco su Mac e iOS
        style={{ scrollBehavior: 'smooth', overscrollBehaviorX: 'none' }} 
        // Eventi Mouse per il Grab
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        // Evento Scroll per navigazione infinita
        onScroll={handleScroll}
      >
        <div 
            className="relative h-full flex" 
            style={{ width: `${totalWidth}px`, minWidth: '100%' }} // Forza la larghezza
        >
            
          {/* GRIGLIA E COLONNE */}
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
                {/* HEADER (Sticky simulato per ogni colonna) */}
                <div className="h-14 border-b border-gray-100 dark:border-zinc-800 bg-white/95 dark:bg-black/95 flex flex-col justify-center items-center sticky top-0 z-30 pointer-events-none select-none">
                    <span className="text-[10px] font-black uppercase text-gray-400 dark:text-zinc-500 tracking-wider">
                        {timeHeader[i]?.label}
                    </span>
                    <span className={`text-sm font-bold mt-0.5 ${timeHeader[i]?.isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-zinc-300'}`}>
                        {timeHeader[i]?.sub}
                    </span>
                </div>
                {/* Effetto Hover Sfondo */}
                <div className="absolute inset-0 top-14 hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 pointer-events-none transition-colors" />
             </div>
          ))}

          {/* COLONNA BUFFER (Evita il bianco a fine corsa) */}
          <div className="flex-shrink-0 w-40 h-full border-r border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex items-center justify-center">
             <span className="text-xs text-gray-400 rotate-90 whitespace-nowrap">Carico...</span>
          </div>

          {/* LINEA OGGI */}
          {viewMode !== 'year' && days.some(d => isSameDay(d, new Date())) && (
             <div 
                className="absolute top-14 bottom-0 border-l-2 border-blue-500 z-10 pointer-events-none opacity-50 dashed"
                style={{ left: `${(days.findIndex(d => isSameDay(d, new Date())) * COLUMN_WIDTH) + (COLUMN_WIDTH/2)}px` }}
             />
          )}

          {/* ATTIVITÀ RENDERIZZATE */}
          <div className="absolute top-14 left-0 right-0 bottom-0 pointer-events-none">
             <div className="relative w-full h-full">
                {activities && activities.map((activity, index) => {
                  // Calcolo posizione
                  const startIdx = viewMode === 'year' 
                    ? days.findIndex(d => d.getMonth() === activity.start.getMonth() && d.getFullYear() === activity.start.getFullYear())
                    : days.findIndex(d => isSameDay(d, activity.start));
                  
                  // Se l'attività è fuori vista (dopo la fine), non renderizzarla
                  if (startIdx === -1 && activity.start > days[days.length-1]) return null;

                  let left = startIdx * COLUMN_WIDTH;
                  let width = (viewMode === 'year' ? activity.days / 30 : activity.days) * COLUMN_WIDTH;

                  // Gestione taglio attività che iniziano prima dell'inizio vista
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
                      // pointer-events-auto è cruciale qui, altrimenti il click passa sotto allo sfondo e attiva il Grab
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