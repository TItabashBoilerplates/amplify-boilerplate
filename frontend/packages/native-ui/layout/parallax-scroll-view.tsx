import type { PropsWithChildren, ReactElement } from 'react'
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated'

import { Box } from '../components/box'

const HEADER_HEIGHT = 250

type Props = PropsWithChildren<{
  headerImage: ReactElement
}>

export default function ParallaxScrollView({ children, headerImage }: Props) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  const scrollOffset = useScrollOffset(scrollRef)
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75]
          ),
        },
        {
          scale: interpolate(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [2, 1, 1]),
        },
      ],
    }
  })

  return (
    <Animated.ScrollView ref={scrollRef} className="flex-1 bg-background" scrollEventThrottle={16}>
      <Animated.View className="h-[250px] overflow-hidden bg-card" style={headerAnimatedStyle}>
        {headerImage}
      </Animated.View>
      <Box className="flex-1 gap-4 overflow-hidden p-8">{children}</Box>
    </Animated.ScrollView>
  )
}
