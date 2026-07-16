import React from 'react';
import { Text } from 'ink';
import Spinner from 'ink-spinner';

export interface LoadingSpinnerProps {
  label?: string;
}

export function LoadingSpinner({ label }: LoadingSpinnerProps) {
  return (
    <Text>
      <Spinner type="dots" /> {label ?? 'Loading...'}
    </Text>
  );
}
