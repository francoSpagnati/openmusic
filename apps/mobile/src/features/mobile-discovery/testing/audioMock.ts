/** In-memory stand-in for expo-audio's native player (used through `jest.mock('expo-audio')`). */
export interface FakePlayer {
  loop: boolean;
  source: string | null;
  playing: boolean;
  replace: jest.Mock;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
}

export function createFakeAudio() {
  const player: FakePlayer = {
    loop: false,
    source: null,
    playing: false,
    replace: jest.fn((src: { uri: string }) => {
      player.source = src.uri;
    }),
    play: jest.fn(() => {
      player.playing = true;
    }),
    pause: jest.fn(() => {
      player.playing = false;
    }),
    seekTo: jest.fn(async () => undefined),
  };
  const preload = jest.fn(async () => undefined);
  const clearPreloadedSource = jest.fn(async () => undefined);
  return {
    player,
    module: {
      useAudioPlayer: () => player,
      useAudioPlayerStatus: () => ({
        playing: player.playing,
        isBuffering: false,
        isLoaded: player.source !== null,
        currentTime: 0,
        duration: 30,
        didJustFinish: false,
      }),
      preload,
      clearPreloadedSource,
      setAudioModeAsync: jest.fn(async () => undefined),
    },
    preload,
    clearPreloadedSource,
  };
}
