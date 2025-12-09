/**
 * Tests for format utility functions
 * 
 * These tests verify the formatting logic for topic labels and hit labels
 * used throughout the application UI.
 */

import { formatTopicLabel, formatHitLabel } from '@app/lib/format';

describe('formatTopicLabel', () => {
  it('should convert slug with hyphens to title case', () => {
    expect(formatTopicLabel('land-use')).toBe('Land Use');
  });

  it('should convert slug with underscores to title case', () => {
    expect(formatTopicLabel('zoning_and_planning')).toBe('Zoning and Planning');
  });

  it('should handle mixed separators', () => {
    expect(formatTopicLabel('housing_and-zoning')).toBe('Housing and Zoning');
  });

  it('should preserve lowercase words like "and", "of", "for" in middle positions', () => {
    expect(formatTopicLabel('taxes_and_budget')).toBe('Taxes and Budget');
    expect(formatTopicLabel('city_of_wichita')).toBe('City of Wichita');
    expect(formatTopicLabel('planning_for_future')).toBe('Planning for Future');
  });

  it('should capitalize first word even if it is a lowercase word', () => {
    expect(formatTopicLabel('and_more')).toBe('And More');
  });

  it('should handle already human-readable labels', () => {
    expect(formatTopicLabel('Land Use')).toBe('Land Use');
    expect(formatTopicLabel('Zoning and Planning')).toBe('Zoning and Planning');
  });

  it('should handle empty string', () => {
    expect(formatTopicLabel('')).toBe('');
  });

  it('should handle single word', () => {
    expect(formatTopicLabel('zoning')).toBe('Zoning');
  });

  it('should handle multiple spaces', () => {
    expect(formatTopicLabel('land  use')).toBe('Land Use');
  });

  it('should trim whitespace', () => {
    expect(formatTopicLabel('  zoning  ')).toBe('Zoning');
  });
});

describe('formatHitLabel', () => {
  it('should format with numeric value', () => {
    expect(formatHitLabel('zoning', 5)).toBe('Zoning (5)');
    expect(formatHitLabel('housing', 10)).toBe('Housing (10)');
  });

  it('should format with object value containing numbers', () => {
    expect(formatHitLabel('zoning', { count: 3, total: 5 })).toBe('Zoning (8)');
    expect(formatHitLabel('budget', { value: 100 })).toBe('Budget (100)');
  });

  it('should format without count when value is null', () => {
    expect(formatHitLabel('zoning', null)).toBe('Zoning');
  });

  it('should format without count when value is undefined', () => {
    expect(formatHitLabel('zoning', undefined)).toBe('Zoning');
  });

  it('should format without count when value is empty object', () => {
    expect(formatHitLabel('zoning', {})).toBe('Zoning');
  });

  it('should format without count when object has no numeric values', () => {
    expect(formatHitLabel('zoning', { text: 'value' })).toBe('Zoning');
  });

  it('should handle slug-like keys and format them', () => {
    expect(formatHitLabel('land-use', 3)).toBe('Land Use (3)');
    expect(formatHitLabel('zoning_and_planning', 7)).toBe('Zoning and Planning (7)');
  });

  it('should sum multiple numeric values in object', () => {
    expect(formatHitLabel('topic', { a: 2, b: 3, c: 5 })).toBe('Topic (10)');
  });

  it('should ignore non-numeric values when summing', () => {
    expect(formatHitLabel('topic', { a: 2, b: 'text', c: 3 })).toBe('Topic (5)');
  });

  it('should handle zero count', () => {
    expect(formatHitLabel('zoning', 0)).toBe('Zoning (0)');
  });
});

