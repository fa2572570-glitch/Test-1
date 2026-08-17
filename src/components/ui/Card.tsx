import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'outline' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-7',
  };

  const variantStyles = {
    default: 'bg-zinc-900 border border-zinc-800 shadow-sm rounded-xl text-zinc-100',
    subtle: 'bg-zinc-900/60 border border-zinc-800/80 rounded-xl text-zinc-100',
    outline: 'bg-transparent border border-zinc-800 rounded-xl text-zinc-100',
    interactive:
      'bg-zinc-900 border border-zinc-800 shadow-sm rounded-xl text-zinc-100 hover:border-zinc-700 hover:bg-zinc-850 transition-all duration-150 cursor-pointer',
  };

  return (
    <div className={`${variantStyles[variant]} ${paddingStyles[padding]} ${className}`} {...props}>
      {children}
    </div>
  );
};
