import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme as NavigationTheme,
} from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { useAuth } from './src/hooks/useAuth';
import { useTheme } from './src/hooks/useTheme';
import { AppNavigator } from './src/navigation/AppNavigator';

// Default queries do not auto-retry so the Stats screen can surface the Error
// state; the in-screen Retry button refetches explicitly.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function buildNavigationTheme(
  base: NavigationTheme,
  colors: { background: string; surface: string; primary: string; text: string; border: string },
): NavigationTheme {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };
}

function RootGate(): React.ReactElement {
  const { state } = useAuth();
  const { theme, mode } = useTheme();

  if (!state.isHydrated) {
    return (
      <View style={[styles.loader, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const navigationTheme = buildNavigationTheme(
    mode === 'dark' ? DarkTheme : DefaultTheme,
    theme.colors,
  );

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <RootGate />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
