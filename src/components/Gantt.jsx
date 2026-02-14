import React, { useEffect, useRef, useMemo, useState, useLayoutEffect } from 'react';
import { 
  format, addDays, startOfWeek, eachDayOfInterval, 
  isSameDay, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, eachMonthOfInterval 
} from 'date-fns';
import { it } from 'date-fns/locale';
import interact from 'interactjs';

// Configurazione larghezza colonna (in px)
const COL_WIDTH = 60; 

export default function Gantt({ currentDate, viewMode, activities, onUpdateActivity, onEditActivity, onDateLongPress, onNavigate }) {
  const containerRef = useRef(null);
  
  // Refs per il "Grab & Drag" su Desktop
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  
  // Ref per direzione navigazione (per il reset dello scroll)
  const lastNavDirection = useRef('next');

  // --- 1. CALCOLO DATE E GRIGLIA ---
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
        totalWidth: 12 * COL_WIDTH 
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
      totalWidth: daysInterval.length * COL_WIDTH 
    };
  }, [currentDate, viewMode]);

  // --- 2. GESTIONE SCROLL AL CAMBIO MESE ---
  useLayoutEffect(() => {
    if (containerRef.current) {
        containerRef.current.style.scrollBehavior = 'auto'; // Disabilita animazione per reset istantaneo
        if (lastNavDirection.current === 'prev') {
            containerRef.current.scrollLeft = containerRef.current.scrollWidth;
        } else {
            containerRef.current.scrollLeft = 0;
        }
        lastNavDirection.current = 'next'; // Reset default
    }
  }, [currentDate, viewMode]);

  // --- 3. GESTIONE MOUSE DRAG SU DESKTOP (Stile Google Maps) ---
  const handleMouseDown = (e) => {
    // Se clicco su un task, non attivo lo scroll dello sfondo
    if (e.target.closest('.draggable-task')) return;
    
    isMouseDown.current = true;
    containerRef.current.style.cursor = 'grabbing';
    startX.current = e.pageX - containerRef.current.offsetLeft;
    scrollLeft.current = containerRef.current.scrollLeft;
  };

  const handleMouseUp = () => {
    isMouseDown.current = false;
    if (containerRef.current) containerRef.current.style.cursor = 'default';
  };

  const handleMouseMove = (e) => {
    if (!isMouseDown.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5; // Velocità scroll
    containerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  // --- 4. GESTIONE SWIPE PER CAMBIO MESE (Sui bordi) ---
  const handleScroll = () => {
    if (!containerRef.current || !onNavigate) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    
    // Se l'utente forza lo scroll oltre i bordi (effetto elastico su Mac/iOS)
    // o arriva a fine corsa, potremmo attivare la navigazione.
    // Qui usiamo una logica semplice: se sei a 0 e provi ad andare indietro -> prev.
    // Nota: L'evento 'scroll' è molto sensibile, meglio gestirlo con parsimonia o pulsanti.
    // Per ora ci affidiamo ai pulsanti Header per il cambio mese per stabilità,
    // o puoi riattivare la logica touchEnd se preferisci lo swipe aggressivo.
  };

  // --- 5. CONFIGURAZIONE INTERACT.JS (DRAG ATTIVITÀ) ---
  useEffect(() => {
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
          const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
          target.style.transform = `translateX(${x}px)`;
          target.setAttribute('data-x', x);
        },
        end(event) {
          const target = event.target;
          const x = parseFloat(target.getAttribute('data-x')) || 0;
          
          // Calcolo spostamento basato su COL_WIDTH fissa
          const unitsMoved = Math.round(x / COL_WIDTH);
          const activityId = target.getAttribute('data-id');
          
          // Nota: Qui leggiamo activities dalle props. Se hai problemi di stale closure, usa un ref.
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
    <div 
      className="flex-1 overflow-hidden flex flex-col bg-background relative select-none"
    >
      {/* 1. HEADER (GIORNI) - SI MUOVE CON LO SCROLL */}
      <div 
        className="flex border-b border-border bg-background/95 backdrop-blur-sm z-20 overflow-hidden"
        // Sincronizziamo manualmente questo header con lo scroll del body se necessario,
        // ma per semplicità lo mettiamo dentro l'area scrollabile o usiamo sticky.
        // Qui usiamo un approccio sticky dentro il container principale.
      />

      {/* 2. AREA SCROLLABILE PRINCIPALE */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        onScroll={handleScroll}
        style={{ scrollBehavior: 'smooth' }}
      >
        <div 
            className="relative h-full" 
            style={{ width: `${totalWidth}px` }} // Larghezza forzata precisa
        >
            
          {/* HEADER STICKY DENTRO LO SCROLL */}
          <div className="sticky top-0 z-30 flex border-b border-border bg-background h-14">
            {timeHeader.map((item, i) => (
              <div 
                key={i} 
                className="absolute top-0 bottom-0 border-r border-border/50 text-center flex flex-col justify-center"
                style={{ width: `${COL_WIDTH}px`, left: `${i * COL_WIDTH}px` }}
              >
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  {item.label}
                </span>
                <span className={`text-sm font-bold mt-0.5 ${item.isToday ? 'text-primary' : 'text-foreground'}`}>
                  {item.sub}
                </span>
              </div>
            ))}
          </div>

          {/* GRIGLIA SFONDO */}
          <div className="absolute top-14 bottom-0 left-0 right-0">
            {days.map((_, i) => (
              <div 
                key={i} 
                className="absolute top-0 bottom-0 border-r border-border/30 hover:bg-accent/50 transition-colors"
                style={{ width: `${COL_WIDTH}px`, left: `${i * COL_WIDTH}px` }}
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
                className="absolute top-14 bottom-0 border-l-2 border-primary z-10 pointer-events-none opacity-50 dashed"
                style={{ 
                    left: `${(days.findIndex(d => isSameDay(d, new Date())) * COL_WIDTH) + (COL_WIDTH/2)}px` 
                }}
             />
          )}

          {/* ATTIVITÀ */}
          <div className="relative pt-6 pb-20 top-14">
            {activities.map((activity, index) => {
              // Logica Posizionamento
              const startIdx = viewMode === 'year' 
                ? days.findIndex(d => d.getMonth() === activity.start.getMonth() && d.getFullYear() === activity.start.getFullYear())
                : days.findIndex(d => isSameDay(d, activity.start));
              
              // Se fuori range a destra
              if (startIdx === -1 && activity.start > days[days.length-1]) return null;

              let left = startIdx * COL_WIDTH;
              let width = (viewMode === 'year' ? activity.days / 30 : activity.days) * COL_WIDTH;

              // Gestione taglio a sinistra (inizia prima del mese corrente)
              if (startIdx === -1 && activity.start < days[0]) {
                 const diff = Math.ceil((days[0] - activity.start) / (1000 * 60 * 60 * 24));
                 width -= diff * COL_WIDTH;
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
                    top: `${index * 50}px`,
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