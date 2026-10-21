import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MusicChatBubble } from '../MusicChatBubble';
import { message } from '../__fixtures__/social';

describe('MusicChatBubble', () => {
  it('lets the receiver react (toggle) and mark the track as listened', async () => {
    const onReact = jest.fn();
    const onMarkListened = jest.fn();
    const m = message({ reaction: 'FIRE' });
    await render(
      <MusicChatBubble
        message={m}
        isMine={false}
        onReact={onReact}
        onMarkListened={onMarkListened}
      />
    );

    expect(screen.getByText('Weird Fishes/Arpeggi')).toBeTruthy();
    expect(screen.getByText('Non ancora ascoltato')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Reazione Cuore'));
    expect(onReact).toHaveBeenLastCalledWith(m, 'HEART');
    // Tapping the active reaction clears it.
    await fireEvent.press(screen.getByLabelText('Reazione Fuoco'));
    expect(onReact).toHaveBeenLastCalledWith(m, null);

    await fireEvent.press(screen.getByLabelText('Segna come ascoltato'));
    expect(onMarkListened).toHaveBeenCalledWith(m);
  });

  it('shows the sender only the reaction received, read-only, and no "ascoltato" action', async () => {
    await render(
      <MusicChatBubble message={message({ reaction: 'HEART', isListened: true })} isMine />
    );
    expect(screen.queryByLabelText('Reazione Fuoco')).toBeNull();
    expect(screen.getByLabelText('Reazione Cuore').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.queryByLabelText('Segna come ascoltato')).toBeNull();
    expect(screen.getByText('Ascoltato')).toBeTruthy();
  });

  it('opens the best universal link', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<MusicChatBubble message={message()} isMine={false} />);
    await fireEvent.press(
      screen.getByLabelText('Apri Weird Fishes/Arpeggi nella tua app musicale')
    );
    expect(open).toHaveBeenCalledWith('https://www.deezer.com/track/1');
    open.mockRestore();
  });
});
