import { type PropsWithChildren, useState } from 'react'

import { Colors } from '../constants/theme'
import { useColorScheme } from '../hooks/use-color-scheme'
import { Box } from './box'
import { HStack } from './hstack'
import { IconSymbol } from './icon-symbol'
import { Pressable } from './pressable'
import { Text } from './text'

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const theme = useColorScheme() ?? 'light'

  return (
    <Box>
      <Pressable onPress={() => setIsOpen((value) => !value)}>
        <HStack space="sm" className="items-center">
          <IconSymbol
            name="chevron.right"
            size={18}
            weight="medium"
            color={theme === 'light' ? Colors.light.icon : Colors.dark.icon}
            style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
          />
          <Text bold>{title}</Text>
        </HStack>
      </Pressable>
      {isOpen && <Box className="mt-1.5 ml-6">{children}</Box>}
    </Box>
  )
}
