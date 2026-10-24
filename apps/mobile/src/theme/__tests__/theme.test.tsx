import React from 'react';
import * as SecureStore from 'expo-secure-store';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { THEME } from '@openmusic/shared';
import { AppThemeProvider, resolveScheme, useTheme } from '..';
import { Text, ThemeToggle } from '../../components/ui';

function SchemeProbe() {
  const theme = useTheme();
  return <Text testID="probe">{`${theme.name} ${theme.colors.bg}`}</Text>;
}

describe('theme', () => {
  beforeEach(() => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  });

  it('follows the OS unless the user picked a scheme; light when the OS does not say', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('switches scheme from Settings and remembers the choice', async () => {
    await render(
      <AppThemeProvider>
        <SchemeProbe />
        <ThemeToggle />
      </AppThemeProvider>
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Scuro' }));
    expect(screen.getByTestId('probe').props.children).toBe(`dark ${THEME.dark.bg}`);
    expect(screen.getByRole('radio', { name: 'Scuro' }).props.accessibilityState).toEqual({
      checked: true,
    });
    await waitFor(() =>
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('om_theme_preference', 'dark')
    );
  });

  it('restores a stored preference on launch', async () => {
    await SecureStore.setItemAsync('om_theme_preference', 'dark');
    await render(
      <AppThemeProvider>
        <SchemeProbe />
      </AppThemeProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('probe').props.children).toBe(`dark ${THEME.dark.bg}`)
    );
  });

  it('shows nothing until the stored choice is read, so there is no wrong-theme first frame', async () => {
    await SecureStore.setItemAsync('om_theme_preference', 'dark');
    let release: (value: string | null) => void = () => undefined;
    (SecureStore.getItemAsync as jest.Mock).mockImplementationOnce(
      () => new Promise<string | null>((resolve) => (release = resolve))
    );
    await render(
      <AppThemeProvider>
        <SchemeProbe />
      </AppThemeProvider>
    );
    expect(screen.queryByTestId('probe')).toBeNull();
    release('dark');
    await waitFor(() =>
      expect(screen.getByTestId('probe').props.children).toBe(`dark ${THEME.dark.bg}`)
    );
  });

  it.each([
    ['rejects', () => Promise.reject(new Error('keychain locked'))],
    [
      'throws',
      () => {
        throw new Error('native module missing');
      },
    ],
  ])('follows the system when the secure store %s', async (_label, impl) => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementationOnce(impl);
    (SecureStore.setItemAsync as jest.Mock).mockImplementationOnce(impl);
    await render(
      <AppThemeProvider>
        <SchemeProbe />
        <ThemeToggle />
      </AppThemeProvider>
    );
    await waitFor(() => expect(screen.getByTestId('probe')).toBeTruthy());
    // The choice still applies for this session even though it cannot be saved.
    await fireEvent.press(screen.getByRole('radio', { name: 'Scuro' }));
    expect(screen.getByTestId('probe').props.children).toBe(`dark ${THEME.dark.bg}`);
  });
});
