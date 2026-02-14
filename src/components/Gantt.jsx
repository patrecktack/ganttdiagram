import React, { useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { 
  format, addDays, startOfWeek, eachDayOfInterval, 
  isSameDay, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, eachMonthOfInterval 
} from 'date-fns';
import { it } from 'date-fns/locale';
import interact from 'interactjs';

// LARGHEZZA COLONNA FISSA (Stabilità massima)
const COLUMN_WIDTH = 60; 

export default function Gantt({ currentDate, viewMode, activities, onUpdateActivity, onEditActivity, onDateLongPress, onNavigate }) {
  const containerRef = useRef(null);
  
  // Refs per il "Grab & Drag"
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const lastNavDirection = useRef('next');

  // --- 1. CALCOLO GRIGLIA E DATE ---
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

  // --- 2. RESET SCROLL ISTANTANEO ---
  useLayoutEffect(() => {
    if (containerRef.current) {
        containerRef.current.style.scrollBehavior = 'auto'; // Stop animazioni
        if (lastNavDirection.current === 'prev') {
            // Se torno indietro, mi metto alla fine (meno un po' di margine per non triggerare subito il next)
            containerRef.current.scrollLeft = containerRef.current.scrollWidth - containerRef.current.clientWidth - 2;
        } else {
            // Se vado avanti, mi metto all'inizio
            containerRef.current.scrollLeft = 0;
        }
        lastNavDirection.current = 'next';
    }
  }, [currentDate, viewMode]);

  // --- 3. LOGICA MOUSE DRAG (BLOCCATA AI BORDI) ---
  const handleMouseDown = (e) => {
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
    let newScrollLeft = dragRef.current.scrollLeft - walk;

    // --- PROTEZIONE BORDI (CLAMPING) ---
    // Non permettere di trascinare oltre i limiti fisici (evita il bianco)
    const maxScroll = containerRef.current.scrollWidth - containerRef.current.clientWidth;
    
    if (newScrollLeft < 0) newScrollLeft = 0;
    if (newScrollLeft > maxScroll) newScrollLeft = maxScroll;

    containerRef.current.scrollLeft = newScrollLeft;
  };

  // --- 4. GESTIONE SCROLL NATIVO (TRIGGER NAVIGAZIONE) ---
  const handleScroll = () => {
    if (!containerRef.current || !onNavigate) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    
    // Trigger sensibile ai bordi (con tolleranza minima)
    if (scrollLeft <= 0) {
       // Sei all'inizio
       // Opzionale: onNavigate('prev'); lastNavDirection.current = 'prev';
    } else if (Math.ceil(scrollLeft + clientWidth) >= scrollWidth) {
       // Sei arrivato alla fine esatta -> Cambia Mese
       onNavigate('next'); 
       lastNavDirection.current = 'next';
    }
  };

  // --- 5. INTERACT.JS (SOLO ATTIVITÀ) ---
  useEffect(() => {
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
          target.style.zIndex = '20';
          target.style.opacity = '1';
        }
      }
    });
    return () => interactable.unset();
  }, [activities, viewMode, onUpdateActivity]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-background relative select-none">
      
      {/* AREA SCROLLABILE PRINCIPALE */}
      <div 
        ref={containerRef}
        // "overscroll-none" è fondamentale: blocca l'effetto elastico bianco su Mac/iOS
        className="flex-1 overflow-x-auto overflow-y-hidden relative cursor-grab active:cursor-grabbing overscroll-x-none"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        onScroll={handleScroll}
      >
        <div 
            className="relative h-full flex" 
            // Aggiungiamo 1px extra per evitare problemi di arrotondamento
            style={{ width: `${totalWidth}px`, minWidth: '100%' }} 
        >
            
          {/* GRIGLIA + COLONNE */}
          {days.map((day, i) => (
             <div 
                key={i} 
                className="flex-shrink-0 h-full border-r border-border/40 relative group"
                style={{ width: `${COLUMN_WIDTH}px` }}
                onDoubleClick={() => onDateLongPress(day)}
                onTouchStart={(e) => {
                    const timer = setTimeout(() => onDateLongPress(day), 600);
                    e.target.ontouchend = () => clearTimeout(timer);
                }}
             >
                {/* HEADER (Sticky simulato per cella) */}
                <div className="h-14 border-b border-border bg-background/95 backdrop-blur-sm flex flex-col justify-center items-center sticky top-0 z-30">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                        {timeHeader[i].label}
                    </span>
                    <span className={`text-sm font-bold mt-0.5 ${timeHeader[i].isToday ? 'text-primary' : 'text-foreground'}`}>
                        {timeHeader[i].sub}
                    </span>
                </div>

                {/* SFONDO HOVER */}
                <div className="absolute inset-0 top-14 bg-transparent group-hover:bg-accent/30 pointer-events-none transition-colors" />
             </div>
          ))}

          {/* COLONNA FANTASMA FINALE (Buffer visivo per evitare il bianco puro) */}
          <div className="flex-shrink-0 w-20 h-full border-r border-border/40 bg-accent/10 flex items-center justify-center">
             <span className="text-xs text-muted-foreground rotate-90 whitespace-nowrap">
                Carico...
             </span>
          </div>

          {/* LINEA OGGI */}
          {viewMode !== 'year' && days.some(d => isSameDay(d, new Date())) && (
             <div 
                className="absolute top-14 bottom-0 border-l-2 border-primary z-10 pointer-events-none opacity-50 dashed"
                style={{ 
                    left: `${(days.findIndex(d => isSameDay(d, new Date())) * COLUMN_WIDTH) + (COLUMN_WIDTH/2)}px` 
                }}
             />
          )}

          {/* ATTIVITÀ */}
          <div className="absolute top-14 left-0 right-0 bottom-0 pointer-events-none">
             <div className="relative w-full h-full">
                {activities.map((activity, index) => {
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
                      className={`draggable-task absolute h-10 mb-2 rounded-xl flex items-center px-3 shadow-sm border border-white/10 pointer-events-auto cursor-grab active:cursor-grabbing hover:brightness-110 touch-none ${activity.color}`}
                      onClick={(e) => { e.stopPropagation(); onEditActivity(activity); }}
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