import React from 'react';

interface RetryButtonProps {
  onRetry: () => void;
  isLoading?: boolean;
  label?: string;
  className?: string;
}

export const RetryButton: React.FC<RetryButtonProps> = ({
  onRetry, isLoading = false, label = 'Retry', className = ''
}) => (
  <button
    onClick={onRetry}
    disabled={isLoading}
    className={`btn-secondary ${className}`}
    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
  >
    <span style={{ display: 'inline-block', transform: isLoading ? 'rotate(360deg)' : 'none' }}>
      ↺
    </span>
    {isLoading ? 'Generating...' : label}
  </button>
);
