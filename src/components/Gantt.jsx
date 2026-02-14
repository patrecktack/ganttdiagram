import React, { useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { 
  format, addDays, startOfWeek, eachDayOfInterval, 
  isSameDay, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, eachMonthOfInterval 
} from 'date-fns';
import { it } from 'date-fns/locale';
import interact from 'interactjs';

// CONFIGURAZIONE: Larghezza fissa per stabilità (come nel tuo esempio reference)
const COLUMN_WIDTH = 60; 

export default function Gantt({ currentDate, viewMode, activities, onUpdateActivity, onEditActivity, onDateLongPress, onNavigate }) {
  const scrollContainerRef = useRef(null);
  
  // Refs per la logica "Grab & Drag" su Desktop
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  
  // Ref per direzione navigazione (per reset scroll)
  const lastNavDirection = useRef('next');

  // --- 1. CALCOLO DATI E GRIGLIA ---
  const { days, timeHeader, totalWidth } = useMemo(() => {
    let start, end, daysInterval;

    if (viewMode === 'week') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = addDays(start, 6);
      daysInterval = eachDayOfInterval({ start, end });
    } else if (viewMode === 'month') {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
      daysInterval = eachDayOfInterval({ start, end });
    } else {
      start = startOfYear(currentDate);
      end = endOfYear(currentDate);
      const months = eachMonthOfInterval({ start, end });
      // Vista Anno: usiamo i mesi come colonne
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

  // --- 2. RESET SCROLL ISTANTANEO (ANTI-GLITCH) ---
  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.scrollBehavior = 'auto'; // Disabilita animazioni per il reset
      if (lastNavDirection.current === 'prev') {
        scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth; // Vai alla fine
      } else {
        scrollContainerRef.current.scrollLeft = 0; // Vai all'inizio
      }
      // Riabilita smooth scroll dopo un frame se lo desideri, ma 'auto' è più reattivo per il drag
      lastNavDirection.current = 'next';
    }
  }, [currentDate, viewMode]);

  // --- 3. LOGICA "GRAB & DRAG" PER DESKTOP (MOUSE) ---
  const handleMouseDown = (e) => {
    // Se clicco su un task, lascio gestire a interact.js
    if (e.target.closest('.draggable-task')) return;
    
    dragRef.current.isDown = true;
    dragRef.current.startX = e.pageX - scrollContainerRef.current.offsetLeft;
    dragRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
    scrollContainerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseLeave = () => {
    dragRef.current.isDown = false;
    if(scrollContainerRef.current) scrollContainerRef.current.style.cursor = 'grab';
  };

  const handleMouseUp = () => {
    dragRef.current.isDown = false;
    if(scrollContainerRef.current) scrollContainerRef.current.style.cursor = 'grab';
  };

  const handleMouseMove = (e) => {
    if (!dragRef.current.isDown) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - dragRef.current.startX) * 1.5; // Moltiplicatore velocità scroll
    scrollContainerRef.current.scrollLeft = dragRef.current.scrollLeft - walk;
  };

  // --- 4. GESTIONE CAMBIO MESE A FINE CORSA (MOBILE & DESKTOP) ---
  const handleScroll = () => {
    if (!scrollContainerRef.current || !onNavigate) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    
    // Tolleranza di 5px dai bordi
    if (scrollLeft <= 0) {
       // Siamo all'inizio -> Tentativo di andare indietro?
       // Nota: Per evitare cambi accidentali, qui potresti aggiungere logica extra
       // o lasciare che l'utente usi le frecce. 
       // Se vuoi il cambio automatico "infinite scroll", decommenta:
       // onNavigate('prev'); lastNavDirection.current = 'prev';
    } else if (scrollLeft + clientWidth >= scrollWidth - 5) {
       // Siamo alla fine -> Tentativo di andare avanti?
       // onNavigate('next'); lastNavDirection.current = 'next';
    }
  };

  // --- 5. CONFIGURAZIONE INTERACT.JS (SOLO PER TASKS) ---
  useEffect(() => {
    const interactable = interact('.draggable-task').draggable({
      inertia: true,
      autoScroll: {
        container: scrollContainerRef.current,
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
          const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
          target.style.transform = `translateX(${x}px)`;
          target.setAttribute('data-x', x);
        },
        end(event) {
          const target = event.target;
          const x = parseFloat(target.getAttribute('data-x')) || 0;
          
          // Calcolo matematico preciso basato sulla larghezza fissa
          const unitsMoved = Math.round(x / COLUMN_WIDTH);
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
          target.style.zIndex = '10';
          target.style.opacity = '1';
          target.style.boxShadow = 'none';
        }
      }
    });

    return () => interactable.unset();
  }, [activities, viewMode, onUpdateActivity]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-black relative select-none">
      
      {/* HEADER FISSO */}
      <div className="flex border-b border-gray-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm z-30 h-14 shadow-sm">
        {/* Usiamo un container interno che scorre sincronizzato o ricalcoliamo la posizione.
            Per semplicità e performance, mettiamo l'header sticky dentro lo scroll container sotto. */}
      </div>

      {/* AREA SCROLLABILE (Main) */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        onScroll={handleScroll}
        style={{ scrollBehavior: 'smooth' }} // Smooth nativo
      >
        <div 
            className="relative h-full" 
            style={{ width: `${totalWidth}px` }} // Larghezza calcolata in pixel (NON %)
        >
            
          {/* HEADER (Sticky dentro lo scroll per allineamento perfetto) */}
          <div className="absolute top-0 left-0 right-0 h-14 flex border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-20 sticky-header" style={{position: 'sticky', left: 0}}>
             {/* Nota: Per un header sticky orizzontale in un div overflow-x, serve posizionamento JS o struttura diversa.
                 Per ora usiamo la struttura a griglia assoluta che è la più robusta. */}
             {timeHeader.map((item, i) => (
                <div 
                  key={i} 
                  className="absolute top-0 bottom-0 border-r border-gray-200 dark:border-zinc-800/50 text-center flex flex-col justify-center"
                  style={{ width: `${COLUMN_WIDTH}px`, left: `${i * COLUMN_WIDTH}px` }}
                >
                  <span className="text-[10px] font-black uppercase text-gray-400 dark:text-zinc-500">
                    {item.label}
                  </span>
                  <span className={`text-sm font-bold mt-0.5 ${item.isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-zinc-300'}`}>
                    {item.sub}
                  </span>
                </div>
             ))}
          </div>

          {/* GRIGLIA DI SFONDO */}
          <div className="absolute top-14 bottom-0 left-0 right-0">
            {days.map((_, i) => (
              <div 
                key={i} 
                className="absolute top-0 bottom-0 border-r border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors"
                style={{ width: `${COLUMN_WIDTH}px`, left: `${i * COLUMN_WIDTH}px` }}
                onDoubleClick={() => onDateLongPress(days[i])}
                // Supporto Long Press mobile
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
                className="absolute top-14 bottom-0 border-l-2 border-blue-500 z-10 pointer-events-none opacity-50 dashed"
                style={{ 
                    left: `${(days.findIndex(d => isSameDay(d, new Date())) * COLUMN_WIDTH) + (COLUMN_WIDTH/2)}px` 
                }}
             />
          )}

          {/* ATTIVITÀ */}
          <div className="relative top-14 pt-6 pb-20">
            {activities.map((activity, index) => {
              // Calcoli di posizione robusti (Pixel based)
              const startIdx = viewMode === 'year' 
                ? days.findIndex(d => d.getMonth() === activity.start.getMonth() && d.getFullYear() === activity.start.getFullYear())
                : days.findIndex(d => isSameDay(d, activity.start));
              
              // Se l'attività non inizia in questo mese, controlliamo se lo attraversa
              if (startIdx === -1 && activity.start > days[days.length-1]) return null;

              let left = startIdx * COLUMN_WIDTH;
              let width = (viewMode === 'year' ? activity.days / 30 : activity.days) * COLUMN_WIDTH;

              // Gestione attività che iniziano prima della vista corrente (taglio a sinistra)
              if (startIdx === -1 && activity.start < days[0]) {
                 const diffDays = Math.ceil((days[0] - activity.start) / (1000 * 60 * 60 * 24));
                 width -= diffDays * COLUMN_WIDTH;
                 left = 0;
              }
              
              if (width <= 0) return null;

              return (
                <div
                  key={activity.id}
                  data-id={activity.id}
                  onClick={() => onEditActivity(activity)}
                  className={`draggable-task absolute h-10 mb-2 rounded-xl flex items-center px-3 shadow-sm border border-white/10 cursor-grab active:cursor-grabbing hover:brightness-110 touch-none ${activity.color}`}
                  style={{
                    left: `${left}px`,
                    width: `${width}px`,
                    top: `${index * 50}px`, // Stack verticale
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
  );
}