/**
 * AnimatedCounter - Smooth Number Animations with Easing
 * Animates numbers with cubic-bezier easing for natural feel
 */

import React from 'react';

export function AnimatedCounter({ value, duration = 1000, suffix = '', prefix = '' }) {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    const startTime = Date.now();
    const startValue = 0;
    const difference = value - startValue;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic for natural feel
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const newValue = Math.floor(startValue + difference * easeProgress);
      
      setDisplayValue(newValue);
      
      if (progress === 1) clearInterval(interval);
    }, 16);

    return () => clearInterval(interval);
  }, [value, duration]);

  return (
    <span className="tabular-nums">
      {prefix}{displayValue.toLocaleString('en-US')}{suffix}
    </span>
  );
}
