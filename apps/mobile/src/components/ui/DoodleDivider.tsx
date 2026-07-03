import { View, type ViewProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Hand-drawn wavy divider, replicated from the Stitch mockup's inline SVG
// (recipe_detail/code.html's .doodle-divider background-image). Stretched to
// fill the container width via preserveAspectRatio="none" — exact wave
// periodicity isn't load-bearing for a decorative divider.
export function DoodleDivider({ className, ...props }: ViewProps) {
  return (
    <View className={className} style={{ height: 8, width: '100%' }} {...props}>
      <Svg width="100%" height={8} viewBox="0 0 150 8" preserveAspectRatio="none">
        <Path
          d="M0 4c10-8 20 8 30 0s20 8 30 0 20-8 30 0 20 8 30 0 20-8 30 0"
          stroke="#EAE3D5"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
