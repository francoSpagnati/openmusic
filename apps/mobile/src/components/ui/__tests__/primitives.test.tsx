import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  CoverArt,
  RatingStars,
  ScoreBadge,
  clampStars,
  ratingFromStars,
  starsFromRating,
} from '..';

describe('RatingStars', () => {
  it('converts between stars and the 10..100 API scale (ADR-001)', () => {
    expect(starsFromRating(70)).toBe(3.5);
    expect(ratingFromStars(3.5)).toBe(70);
    expect(clampStars(0)).toBe(0.5);
    expect(clampStars(4.26)).toBe(4.5);
    expect(clampStars(9)).toBe(5);
  });

  it('sets half and whole stars from the two touch halves', async () => {
    const onChange = jest.fn();
    await render(<RatingStars value={2} onChange={onChange} label="Il tuo voto" />);
    await fireEvent.press(screen.getByTestId('rating-star-3.5'));
    expect(onChange).toHaveBeenLastCalledWith(3.5);
    await fireEvent.press(screen.getByTestId('rating-star-5'));
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it('is an adjustable control that steps by 0.5 for screen readers', async () => {
    const onChange = jest.fn();
    await render(<RatingStars value={3} onChange={onChange} label="Il tuo voto" />);
    const slider = screen.getByLabelText('Il tuo voto');
    expect(slider.props.accessibilityRole).toBe('adjustable');
    expect(slider.props.accessibilityValue).toEqual({ text: '3,0 stelle su 5' });
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(3.5);
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(2.5);
  });

  it('is read-only without onChange', async () => {
    await render(<RatingStars value={4.5} label="Voto medio" />);
    expect(screen.queryByTestId('rating-star-1')).toBeNull();
    expect(screen.getByLabelText('Voto medio').props.accessibilityRole).toBe('image');
  });
});

describe('ScoreBadge', () => {
  it('announces fresh/rotten with text, not colour alone', async () => {
    await render(<ScoreBadge kind="audience" percentage={82} totalReviews={12} />);
    expect(screen.getByLabelText('Voto pubblico: 82% su 12 recensioni, consigliato')).toBeTruthy();
  });

  it('shows "pochi voti" when there is no score yet', async () => {
    await render(<ScoreBadge kind="critic" percentage={null} />);
    expect(screen.getByLabelText('Voto critica: pochi voti')).toBeTruthy();
  });
});

describe('CoverArt', () => {
  it('renders the remote cover with expo-image', async () => {
    await render(
      <CoverArt uri="https://cdn.example/cover.jpg" label="Copertina di OK Computer" size={96} />
    );
    expect(screen.getByTestId('cover-image')).toBeTruthy();
    expect(screen.getByLabelText('Copertina di OK Computer')).toBeTruthy();
  });

  it('falls back to the vinyl placeholder without a URL', async () => {
    await render(<CoverArt uri={null} size={96} />);
    expect(screen.getByTestId('cover-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('cover-image')).toBeNull();
  });
});
