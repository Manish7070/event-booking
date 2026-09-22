import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading...', fullScreen = false }) => {
  const content = (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <Loader2 className="w-10 h-10 text-violet-500 animate-spin mb-4" />
      <p className="text-slate-400 text-sm font-medium">{message}</p>
    </div>
  );

  if (fullScreen) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center">{content}</div>;
  }

  return content;
};
