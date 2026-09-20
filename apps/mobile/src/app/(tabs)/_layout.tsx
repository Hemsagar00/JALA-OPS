import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { BRAND } from '@jala-ops/constants';
import TabIcon from '../../components/tab-icon';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND.navy,
        tabBarInactiveTintColor: BRAND.muted,
        tabBarStyle: {
          backgroundColor: BRAND.surface,
          borderTopColor: BRAND.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 86 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          elevation: 4,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="readings"
        options={{
          title: 'Readings',
          tabBarLabel: 'Readings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="readings" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="breakdowns"
        options={{
          title: 'Breakdowns',
          tabBarLabel: 'Breakdowns',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="breakdowns" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarLabel: 'Tasks',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="tasks" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="profile" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
