import React, { useState, useEffect, useRef } from "react";

export function FormScaleWrapper({ children }: { children: React.ReactNode }) {
  const [formScale, setFormScale] = useState(1);
  const [formHeight, setFormHeight] = useState<number | 'auto'>('auto');
  const innerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const calculateScale = () => {
      const availableWidth = window.innerWidth - 32;
      const scale = availableWidth < 800 ? availableWidth / 800 : 1;
      setFormScale(scale);
      
      if (innerRef.current && scale < 1) {
        setFormHeight(innerRef.current.offsetHeight * scale);
      } else {
        setFormHeight('auto');
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    
    let observer: ResizeObserver | null = null;
    if (innerRef.current) {
      observer = new ResizeObserver(() => calculateScale());
      observer.observe(innerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', calculateScale);
      if (observer) observer.disconnect();
    };
  }, []);

  return (
    <div className="overflow-hidden origin-top-left transition-[height] duration-200" style={{ height: formHeight }}>
      <div 
        ref={innerRef}
        className="w-[800px] origin-top-left transition-transform duration-200" 
        style={{ transform: formScale < 1 ? `scale(${formScale})` : 'none' }}
      >
        {children}
      </div>
    </div>
  );
}
