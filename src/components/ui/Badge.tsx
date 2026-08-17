import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 rounded-full font-medium',
    md: 'text-sm px-2.5 py-1 rounded-full font-medium',
  };

  const variantStyles = {
    neutral: 'bg-zinc-800 text-zinc-300 border border-zinc-700',
    success: 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80',
    warning: 'bg-amber-950/70 text-amber-300 border border-amber-800/80',
    error: 'bg-rose-950/70 text-rose-300 border border-rose-800/80',
    info: 'bg-sky-950/70 text-sky-300 border border-sky-800/80',
    purple: 'bg-purple-950/70 text-purple-300 border border-purple-800/80',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
