import React from "react";
import { Search } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title = "No results found",
  message = "We could not find anything matching your request.",
  actionText,
  onAction,
}) => {
  return (
    <div className="glass-panel rounded-2xl p-12 text-center my-8 max-w-lg mx-auto">
      <div className="w-14 h-14 bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
        {icon || <Search className="w-7 h-7" />}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">{message}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-semibold shadow-lg transition text-sm cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
