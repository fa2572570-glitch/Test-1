import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap cursor-pointer';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 rounded-md gap-1.5 min-h-[32px]',
    md: 'text-sm px-4 py-2 rounded-lg gap-2 min-h-[40px]',
    lg: 'text-base px-5 py-2.5 rounded-lg gap-2.5 min-h-[48px]',
  };

  const variantStyles = {
    primary:
      'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 focus-visible:ring-indigo-500 border border-indigo-500/80 shadow-xs font-semibold',
    secondary:
      'bg-zinc-800 text-zinc-100 hover:bg-zinc-750 hover:border-zinc-600 active:bg-zinc-700 focus-visible:ring-zinc-500 border border-zinc-700 shadow-xs',
    outline:
      'bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800 hover:text-white active:bg-zinc-750 border border-zinc-750 hover:border-zinc-600 focus-visible:ring-zinc-500',
    danger:
      'bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 focus-visible:ring-rose-500 border border-rose-600',
    ghost:
      'bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white active:bg-zinc-700 focus-visible:ring-zinc-500 border border-transparent',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
