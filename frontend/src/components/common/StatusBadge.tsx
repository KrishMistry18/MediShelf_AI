import React from 'react';
import { Badge } from './Badge';

export interface StatusBadgeProps {
  status:
    | 'healthy'
    | 'degraded'
    | 'error'
    | 'loading'
    | 'SAFE'
    | 'WARNING'
    | 'HIGH_RISK'
    | 'EXPIRED'
    | 'CONFIRMED'
    | 'PARTIAL'
    | 'DIVERGENT'
    | 'UNCONFIRMED'
    | string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const normalized = status.toUpperCase();

  switch (normalized) {
    case 'HEALTHY':
    case 'CONNECTED':
    case 'SAFE':
    case 'CONFIRMED':
    case 'PASSED':
      return (
        <Badge variant="success" size={size} dot className={className}>
          {status}
        </Badge>
      );
    case 'DEGRADED':
    case 'WARNING':
    case 'PARTIAL':
      return (
        <Badge variant="warning" size={size} dot className={className}>
          {status}
        </Badge>
      );
    case 'ERROR':
    case 'DISCONNECTED':
    case 'HIGH_RISK':
    case 'EXPIRED':
    case 'DIVERGENT':
    case 'FAILED':
      return (
        <Badge variant="danger" size={size} dot className={className}>
          {status}
        </Badge>
      );
    case 'LOADING':
    case 'CONNECTING':
      return (
        <Badge variant="info" size={size} dot className={className}>
          {status}
        </Badge>
      );
    case 'UNCONFIRMED':
    default:
      return (
        <Badge variant="neutral" size={size} dot className={className}>
          {status}
        </Badge>
      );
  }
};
