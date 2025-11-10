"use client";

import { useState } from "react";

export function SplitViewer({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  const [ratio, setRatio] = useState(50);
  
  return (
    <div className="w-full h-[85vh] border border-white/10 rounded-[--radius-lg] overflow-hidden relative bg-surface/60 backdrop-blur">
      <div className="flex w-full h-full">
        <div style={{ width: `${ratio}%` }} className="h-full overflow-auto">
          {left}
        </div>
        <div 
          className="w-1 bg-white/20 cursor-col-resize hover:bg-white/30 transition-colors" 
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startRatio = ratio;
            
            function onMove(ev: MouseEvent) {
              const dx = ev.clientX - startX;
              const container = (e.currentTarget as HTMLDivElement).parentElement as HTMLDivElement;
              const total = container.clientWidth;
              const newRatio = Math.min(80, Math.max(20, startRatio + (dx / total) * 100));
              setRatio(newRatio);
            }
            
            function onUp() {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            }
            
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }} 
        />
        <div style={{ width: `${100 - ratio}%` }} className="h-full overflow-auto">
          {right}
        </div>
      </div>
    </div>
  );
}
