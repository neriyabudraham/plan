interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export default function Loading({ size = 'md', fullScreen = false }: LoadingProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };
  
  const spinner = (
    <div
      className={`${sizeClasses[size]} border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin`}
    />
  );
  
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-50">
        {spinner}
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-center p-8">
      {spinner}
    </div>
  );
}
