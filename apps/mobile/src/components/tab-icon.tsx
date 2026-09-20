import React from 'react';
import { View, Text, StyleSheet, type ColorValue } from 'react-native';

export type TabIconName = 'home' | 'readings' | 'breakdowns' | 'tasks' | 'profile';

interface TabIconProps {
  name: TabIconName;
  focused: boolean;
  color: ColorValue | string;
  size?: number;
}

export default function TabIcon({ name, focused, color, size = 22 }: TabIconProps) {
  const glyph = getTabGlyph(name);

  return (
    <View style={[styles.container, focused && styles.focusedContainer]}>
      <Text style={[styles.glyph, { color, fontSize: size }]}>{glyph}</Text>
    </View>
  );
}

function getTabGlyph(name: TabIconName): string {
  switch (name) {
    case 'home':
      return '⌂';
    case 'readings':
      return '💧';
    case 'breakdowns':
      return '⚠️';
    case 'tasks':
      return '📋';
    case 'profile':
      return '👤';
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  focusedContainer: {
    backgroundColor: 'rgba(10, 43, 102, 0.08)',
  },
  glyph: {
    textAlign: 'center',
    fontWeight: '700',
  },
});
