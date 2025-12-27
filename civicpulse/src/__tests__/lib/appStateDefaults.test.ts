/**
 * Tests for app state defaults and normalization
 * 
 * These tests verify that the normalizeAppState function correctly
 * fills in missing fields from DEFAULT_APP_STATE and preserves provided values.
 */

import { DEFAULT_APP_STATE, normalizeAppState } from '@app/lib/appStateDefaults';
import type { AppState } from '@app/lib/types';

describe('normalizeAppState', () => {
  it('should return DEFAULT_APP_STATE when input is null', () => {
    const result = normalizeAppState(null);
    expect(result).toEqual(DEFAULT_APP_STATE);
  });

  it('should return DEFAULT_APP_STATE when input is undefined', () => {
    const result = normalizeAppState(undefined);
    expect(result).toEqual(DEFAULT_APP_STATE);
  });

  it('should fill missing fields from DEFAULT_APP_STATE', () => {
    const partial: Partial<AppState> = {
      savedItemIds: ['item-1', 'item-2'],
    };

    const result = normalizeAppState(partial);

    expect(result.savedItemIds).toEqual(['item-1', 'item-2']);
    expect(result.preferences).toBeNull();
    expect(result.followedItemIds).toEqual([]);
    expect(result.briefItemIds).toEqual([]);
    expect(result.savedBriefs).toEqual([]);
    expect(result.searchUi).toEqual(DEFAULT_APP_STATE.searchUi);
  });

  it('should preserve provided fields', () => {
    const customState: Partial<AppState> = {
      preferences: {
        workspaceName: 'Test Workspace',
        jurisdictions: ['Sedgwick County'],
        topics: ['zoning'],
        alertCadence: 'Daily',
        impactThreshold: 'High',
      },
      savedItemIds: ['doc-1', 'doc-2'],
      followedItemIds: ['doc-3'],
      briefItemIds: ['doc-4'],
    };

    const result = normalizeAppState(customState);

    expect(result.preferences).toEqual(customState.preferences);
    expect(result.savedItemIds).toEqual(['doc-1', 'doc-2']);
    expect(result.followedItemIds).toEqual(['doc-3']);
    expect(result.briefItemIds).toEqual(['doc-4']);
  });

  it('should not mutate input object', () => {
    const input: Partial<AppState> = {
      savedItemIds: ['original-1'],
    };

    const originalSavedItemIds = input.savedItemIds;
    const result = normalizeAppState(input);

    // Input should be unchanged
    expect(input.savedItemIds).toBe(originalSavedItemIds);
    expect(input.savedItemIds).toEqual(['original-1']);

    // Result should be a new object
    expect(result).not.toBe(input);
    expect(result.savedItemIds).toEqual(['original-1']);
  });

  it('should normalize nested searchUi object', () => {
    const partial: Partial<AppState> = {
      searchUi: {
        query: 'test query',
        selectedDocTypes: ['Agenda'],
      },
    };

    const result = normalizeAppState(partial);

    expect(result.searchUi.query).toBe('test query');
    expect(result.searchUi.selectedDocTypes).toEqual(['Agenda']);
    // Should fill in missing searchUi fields from DEFAULT_APP_STATE
    expect(result.searchUi.counties).toEqual(DEFAULT_APP_STATE.searchUi.counties);
    expect(result.searchUi.meetingDateFrom).toBeNull();
    expect(result.searchUi.meetingDateTo).toBeNull();
    expect(result.searchUi.topics).toEqual([]);
    expect(result.searchUi.selectedIds).toEqual([]);
    expect(result.searchUi.page).toBe(0);
  });

  it('should use default selectedDocTypes when empty array provided', () => {
    const partial: Partial<AppState> = {
      searchUi: {
        selectedDocTypes: [],
      },
    };

    const result = normalizeAppState(partial);

    // Empty array should be replaced with default
    expect(result.searchUi.selectedDocTypes).toEqual(DEFAULT_APP_STATE.searchUi.selectedDocTypes);
  });

  it('should preserve non-empty selectedDocTypes', () => {
    const partial: Partial<AppState> = {
      searchUi: {
        selectedDocTypes: ['Minutes', 'Ordinance'],
      },
    };

    const result = normalizeAppState(partial);

    expect(result.searchUi.selectedDocTypes).toEqual(['Minutes', 'Ordinance']);
  });

  it('should handle invalid array fields by using defaults', () => {
    const partial: Partial<AppState> = {
      savedItemIds: 'not-an-array' as unknown as string[],
      searchUi: {
        counties: 'not-an-array' as unknown as string[],
      },
    };

    const result = normalizeAppState(partial);

    expect(result.savedItemIds).toEqual([]);
    expect(result.searchUi.counties).toEqual(DEFAULT_APP_STATE.searchUi.counties);
  });

  it('should handle complete state with all fields', () => {
    const completeState: AppState = {
      preferences: {
        workspaceName: 'Complete Workspace',
        jurisdictions: ['Johnson County'],
        topics: ['housing'],
        alertCadence: 'Weekly',
        impactThreshold: 'Medium',
      },
      savedItemIds: ['saved-1'],
      followedItemIds: ['followed-1'],
      briefItemIds: ['brief-1'],
      savedBriefs: [
        {
          id: 'brief-1',
          name: 'Test Brief',
          description: 'Test Description',
          itemIds: ['doc-1'],
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          documentCount: 1,
        },
      ],
      searchUi: {
        query: 'test',
        selectedDocTypes: ['Agenda'],
        counties: ['Sedgwick County'],
        meetingDateFrom: '2025-01-01',
        meetingDateTo: '2025-01-31',
        topics: ['zoning'],
        selectedIds: ['doc-1'],
        page: 1,
      },
    };

    const result = normalizeAppState(completeState);

    expect(result).toEqual(completeState);
  });

  it('should handle partial searchUi with some fields missing', () => {
    const partial: Partial<AppState> = {
      searchUi: {
        query: 'partial query',
        page: 2,
      },
    };

    const result = normalizeAppState(partial);

    expect(result.searchUi.query).toBe('partial query');
    expect(result.searchUi.page).toBe(2);
    expect(result.searchUi.selectedDocTypes).toEqual(DEFAULT_APP_STATE.searchUi.selectedDocTypes);
    expect(result.searchUi.counties).toEqual(DEFAULT_APP_STATE.searchUi.counties);
    expect(result.searchUi.meetingDateFrom).toBeNull();
    expect(result.searchUi.meetingDateTo).toBeNull();
    expect(result.searchUi.topics).toEqual([]);
    expect(result.searchUi.selectedIds).toEqual([]);
  });
});

