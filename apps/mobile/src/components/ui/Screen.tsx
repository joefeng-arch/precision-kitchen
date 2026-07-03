import { SafeAreaView } from 'react-native-safe-area-context';
import type { ViewProps } from 'react-native';

export function Screen({ className, ...props }: ViewProps) {
  return (
    <SafeAreaView
      className={`flex-1 bg-paper ${className ?? ''}`}
      {...props}
    />
  );
}
