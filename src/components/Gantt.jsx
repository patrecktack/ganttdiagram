import React, { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { 
  format, eachDayOfInterval, eachMonthOfInterval, 
  startOfWeek, endOfWeek, startOfYear, endOfYear,
  differenceInCalendarDays, differenceInCalendarMonths, 
  isSameDay, isSameMonth, addDays, startOfMonth, endOfMonth,
  subYears, addYears
} from 'date-fns';
import { it } from 'date-fns/locale';

export default function Gantt({ currentDate, setCurrentDate, viewMode, activities, onDateLongPress, onEditActivity, onUpdateActivity }) {
  
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const containerRef = useRef(null);
  const [anchorDate] = useState(new Date()); 

  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const isScrollingRef = useRef(false); 

  // type: 'resize-start' | 'resize-end' | 'move'
  const [interaction, setInteraction] = useState(null);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { columns, startDate } = useMemo(() => {
    let start, end;
    if (viewMode === 'year') {
        start = startOfYear(subYears(anchorDate, 5));
        end = endOfYear(addYears(anchorDate, 5));
        return { columns: eachMonthOfInterval({ start, end }), startDate: start };
    } else {
        start = startOfMonth(subYears(anchorDate, 5));
        end = endOfMonth(addYears(anchorDate, 5));
        return { columns: eachDayOfInterval({ start, end }), startDate: start };
    }
  }, [viewMode, anchorDate]); 

  const colWidth = useMemo(() => {
    if (viewMode === 'week') {
      const padding = 20; 
      return Math.max((screenWidth - padding) / 7, 50); 
    }
    return viewMode === 'year' ? 80 : 56;
  }, [viewMode, screenWidth]);

  const isYearView = viewMode === 'year';

  // --- LOGICA INTERAZIONE ---
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (!interaction) return;

      const deltaX = e.pageX - interaction.startX;
      const daysDelta = Math.round(deltaX / colWidth);

      if (daysDelta === 0) return;

      const targetActivity = activities.find(a => a.id === interaction.id);
      if (!targetActivity) return;

      if (interaction.type === 'resize-start') {
        const newStart = addDays(interaction.initialStart, daysDelta);
        const newDays = interaction.initialDays - daysDelta;
        if (newDays >= 1) {
          onUpdateActivity({ ...targetActivity, start: newStart, days: newDays });
        }
      } 
      else if (interaction.type === 'resize-end') {
        const newDays = interaction.initialDays + daysDelta;
        if (newDays >= 1) {
          onUpdateActivity({ ...targetActivity, days: newDays });
        }
      }
      else if (interaction.type === 'move') {
        const newStart = addDays(interaction.initialStart, daysDelta);
        onUpdateActivity({ ...targetActivity, start: newStart });
      }
    };

    const handleGlobalMouseUp = (e) => {
      if (interaction) {
        if (interaction.type === 'move') {
            const dist = Math.abs(e.pageX - interaction.startX);
            if (dist < 5) {
                onEditActivity(activities.find(a => a.id === interaction.id));
            }
        }
        setInteraction(null);
        document.body.style.cursor = 'default';
      }
    };

    if (interaction) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = interaction.type.startsWith('resize') ? 'ew-resize' : 'grabbing';
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [interaction, colWidth, onUpdateActivity, activities, onEditActivity]);

  const handleScroll = () => {
      if (!containerRef.current) return;
      const centerScroll = containerRef.current.scrollLeft + (screenWidth / 2);
      const centerIndex = Math.floor(centerScroll / colWidth);
      if (columns[centerIndex]) {
          const dateAtCenter = columns[centerIndex];
          const shouldUpdate = isYearView 
            ? format(dateAtCenter, 'yyyy') !== format(currentDate, 'yyyy')
            : format(dateAtCenter, 'yyyy-MM') !== format(currentDate, 'yyyy-MM');
          if (shouldUpdate) {
             isScrollingRef.current = true;
             setCurrentDate(dateAtCenter);
          }
      }
  };

  useLayoutEffect(() => {
    if (containerRef.current && !isScrollingRef.current) {
        let offset;
        if (isYearView) {
            offset = differenceInCalendarMonths(currentDate, startDate) * colWidth;
        } else {
            offset = differenceInCalendarDays(currentDate, startDate) * colWidth;
        }
        containerRef.current.scrollTo({
            left: offset - (screenWidth / 2) + (colWidth / 2),
            behavior: 'smooth' 
        });
    }
    isScrollingRef.current = false;
  }, [currentDate, viewMode, colWidth, startDate, screenWidth, isYearView]);

  const onMouseDown = (e) => {
    if (interaction) return; 
    isDown.current = true;
    containerRef.current.style.cursor = 'grabbing';
    startX.current = e.pageX - containerRef.current.offsetLeft;
    scrollLeft.current = containerRef.current.scrollLeft;
    e.preventDefault(); 
  };
  const onMouseUp = () => { isDown.current = false; if (containerRef.current) containerRef.current.style.cursor = 'grab'; };
  const onMouseLeave = () => { isDown.current = false; if (containerRef.current) containerRef.current.style.cursor = 'grab'; };
  const onMouseMove = (e) => {
    if (!isDown.current || interaction) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    containerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const timerRef = useRef(null);
  const handleStartPress = (date) => {
    if (isDown.current || interaction) return;
    timerRef.current = setTimeout(() => {
      if (isDown.current || interaction) return;
      if (navigator.vibrate) navigator.vibrate(50); 
      onDateLongPress(date); 
    }, 600);
  };
  const handleCancelPress = () => { if (timerRef.current) clearTimeout(timerRef.current); };

  if (columns.length === 0) return null;

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll} 
      onMouseDown={onMouseDown}
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
      className="flex-1 overflow-x-auto no-scrollbar relative cursor-grab mt-4 border-t transition-colors bg-white border-gray-300 dark:bg-black dark:border-zinc-700 select-none"
    >
      <div className="min-w-fit pb-40 pl-4" style={{ width: columns.length * colWidth }}> 
        <div className="flex sticky top-0 z-40 pt-5 pb-3 border-b backdrop-blur-md transition-colors bg-white/95 border-gray-300 dark:bg-black/90 dark:border-zinc-700">
          {columns.map((col, i) => {
            const isCurrent = isYearView ? isSameMonth(col, new Date()) : isSameDay(col, new Date());
            const isFirstOfMonth = !isYearView && col.getDate() === 1;
            return (
              <div key={i} style={{ width: colWidth }} className="flex-none flex flex-col items-center justify-center group overflow-hidden pointer-events-none relative">
                <span className={`text-sm font-bold transition-transform ${isCurrent ? 'scale-125 text-black dark:text-white' : 'text-gray-400 group-hover:text-gray-600 dark:text-zinc-500 dark:group-hover:text-zinc-300'}`}>{format(col, isYearView ? 'MMM' : 'd', {locale:it})}</span>
                {!isYearView && (<span className="text-[9px] uppercase font-bold mt-1 tracking-wider text-gray-400 dark:text-zinc-600">{format(col, 'EEEEE', { locale: it })}</span>)}
                {isFirstOfMonth && (<span className="absolute -top-3 left-1 text-[10px] font-bold text-black dark:text-white uppercase tracking-widest bg-white dark:bg-black px-1 rounded">{format(col, 'MMMM', {locale:it})}</span>)}
              </div>
            );
          })}
        </div>
        <div className="relative h-[800px] w-full mt-2">
          <div className="absolute inset-0 flex">
            {columns.map((col, i) => (
              <div key={i} style={{ width: colWidth }} className={`flex-none border-r border-dashed h-full transition-colors ${!isYearView && col.getDate() === 1 ? 'border-gray-400 dark:border-zinc-500' : 'border-gray-200 dark:border-zinc-800'} active:bg-gray-50 dark:active:bg-zinc-900`} onMouseDown={() => handleStartPress(col)} onMouseUp={handleCancelPress} onTouchStart={() => handleStartPress(col)} onTouchEnd={handleCancelPress} />
            ))}
          </div>

          <div className="absolute inset-0 pt-4 pointer-events-none">
            {activities.map((activity, index) => {
              let offsetCols, widthPx;
              if (isYearView) {
                offsetCols = differenceInCalendarMonths(activity.start, startDate);
                const endDate = addDays(activity.start, activity.days);
                const durationMonths = differenceInCalendarMonths(endDate, activity.start) + (activity.days % 30) / 30;
                widthPx = Math.max(durationMonths * colWidth, 10);
              } else {
                offsetCols = differenceInCalendarDays(activity.start, startDate);
                const paddingGap = viewMode === 'week' ? 10 : 6;
                widthPx = Math.max(activity.days * colWidth - paddingGap, 10);
              }

              if (offsetCols < -50 || offsetCols > columns.length + 50) return null;

              return (
                <div
                  key={activity.id}
                  className={`pointer-events-auto absolute h-12 rounded-2xl flex items-center px-4 shadow-sm cursor-grab active:cursor-grabbing hover:brightness-110 transition-all z-10 border border-transparent dark:border-white/10 ${activity.color}`}
                  onMouseDown={(e) => {
                    e.stopPropagation(); 
                    setInteraction({ 
                        type: 'move',
                        id: activity.id, 
                        startX: e.pageX, 
                        initialStart: activity.start,
                        initialDays: activity.days
                    });
                  }}
                  style={{ left: `${offsetCols * colWidth}px`, width: `${widthPx}px`, top: `${index * 60}px` }}
                >
                  
                  {/* --- MANIGLIA SINISTRA --- */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-6 cursor-ew-resize flex items-center justify-center group/handle z-20 hover:bg-black/5 dark:hover:bg-white/10 rounded-l-2xl"
                    onMouseDown={(e) => {
                        e.stopPropagation(); 
                        setInteraction({ 
                            type: 'resize-start',
                            id: activity.id, 
                            startX: e.pageX, 
                            initialStart: activity.start,
                            initialDays: activity.days
                        });
                    }}
                  >
                    {/* Indicatore: Usa bg-current per adattarsi al colore del testo (Nero su Chiaro, Bianco su Scuro) */}
                    <div className="w-1.5 h-6 rounded-full bg-current opacity-30 group-hover/handle:opacity-100 transition-opacity shadow-sm"></div>
                  </div>

                  {/* TITOLO */}
                  <span className="text-xs font-bold truncate drop-shadow-sm sticky left-2 select-none pl-2 flex-1 pointer-events-none">
                    {activity.title}
                  </span>

                  {/* --- MANIGLIA DESTRA --- */}
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-6 cursor-ew-resize flex items-center justify-center group/handle z-20 hover:bg-black/5 dark:hover:bg-white/10 rounded-r-2xl"
                    onMouseDown={(e) => {
                        e.stopPropagation(); 
                        setInteraction({ 
                            type: 'resize-end',
                            id: activity.id, 
                            startX: e.pageX, 
                            initialStart: activity.start,
                            initialDays: activity.days
                        });
                    }}
                  >
                    {/* Indicatore: Usa bg-current per contrasto perfetto */}
                    <div className="w-1.5 h-6 rounded-full bg-current opacity-30 group-hover/handle:opacity-100 transition-opacity shadow-sm"></div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}