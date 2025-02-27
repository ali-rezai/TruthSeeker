"use client";

import React from 'react';
import { cn } from '../lib/utils';

interface LogDisplayProps {
  logs: string[];
  className?: string;
}

export default function LogDisplay({ logs, className }: LogDisplayProps) {
  const logEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Scroll to bottom when logs update
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className={cn("bg-black text-green-400 p-4 rounded-md font-mono text-sm overflow-y-auto max-h-[400px]", className)}>
      <div className="space-y-1">
        {logs.length === 0 ? (
          <div className="text-gray-500">No logs available yet...</div>
        ) : (
          logs.map((log, index) => {
            // Determine log type by prefix
            const isBlue = log.startsWith('[blue]');
            const isRed = log.startsWith('[red]');
            const isFinal = log.startsWith('[final]');

            // Apply different styling based on log type
            const logClass = cn(
              "whitespace-pre-wrap break-words",
              isBlue && "text-blue-400",
              isRed && "text-red-400",
              isFinal && "text-yellow-400"
            );

            return (
              <div key={index} className={logClass}>
                {log}
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
