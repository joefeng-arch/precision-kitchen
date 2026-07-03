import { View } from 'react-native';

import { Typography } from './Typography';

export interface AvatarInitialsProps {
  nickname?: string | null;
  id?: string | null;
  size?: number;
}

function getInitials(nickname?: string | null): string {
  if (!nickname) return '?';
  const parts = nickname.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nickname.slice(0, 2).toUpperCase();
}

// Deterministic tone from a hash of the author id — gives visual variety
// across authors without arbitrary alternating-index logic that has no
// stable data to key off inside a FlatList.
function hashTone(id?: string | null): 'primary' | 'secondary' {
  if (!id) return 'primary';
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return sum % 2 === 0 ? 'primary' : 'secondary';
}

const toneContainerClassName = {
  primary: 'bg-primary-container',
  secondary: 'bg-secondary-container',
} as const;

const toneTextClassName = {
  primary: 'text-on-primary-container',
  secondary: 'text-on-secondary-container',
} as const;

export function AvatarInitials({ nickname, id, size = 24 }: AvatarInitialsProps) {
  const tone = hashTone(id);
  return (
    <View
      className={`items-center justify-center rounded-pill ${toneContainerClassName[tone]}`}
      style={{ width: size, height: size }}
    >
      <Typography
        variant="labelCaps"
        className={toneTextClassName[tone]}
        style={{ fontSize: Math.round(size * 0.42) }}
      >
        {getInitials(nickname)}
      </Typography>
    </View>
  );
}
