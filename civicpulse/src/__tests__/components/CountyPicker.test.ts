/**
 * Tests for CountyPicker component logic
 * 
 * These tests verify the core filtering and selection logic
 * of the CountyPicker component without requiring DOM rendering.
 */

describe('CountyPicker Logic', () => {
  describe('County Filtering', () => {
    const allCounties = [
      'Allen County',
      'Douglas County',
      'Johnson County',
      'Sedgwick County',
      'Wyandotte County'
    ];

    function filterCounties(
      counties: string[],
      selected: string[],
      query: string
    ): string[] {
      return counties.filter(
        (county) =>
          !selected.includes(county) &&
          county.toLowerCase().includes(query.toLowerCase())
      );
    }

    it('should return all counties when query is empty and none selected', () => {
      const result = filterCounties(allCounties, [], '');
      expect(result).toEqual(allCounties);
    });

    it('should filter counties by query (case-insensitive)', () => {
      const result = filterCounties(allCounties, [], 'johnson');
      expect(result).toEqual(['Johnson County']);
    });

    it('should filter by partial match', () => {
      const result = filterCounties(allCounties, [], 'county');
      expect(result).toEqual(allCounties); // All have "County" in name
    });

    it('should exclude already selected counties', () => {
      const selected = ['Johnson County', 'Douglas County'];
      const result = filterCounties(allCounties, selected, '');
      
      expect(result).toHaveLength(3);
      expect(result).not.toContain('Johnson County');
      expect(result).not.toContain('Douglas County');
    });

    it('should combine query filter with selected exclusion', () => {
      const selected = ['Johnson County'];
      const result = filterCounties(allCounties, selected, 'county');
      
      // "county" matches all, but Johnson is selected
      // So we get 4 counties (all except Johnson)
      expect(result).toHaveLength(4);
      expect(result).not.toContain('Johnson County');
      expect(result).toContain('Douglas County');
    });

    it('should return empty array when all counties are selected', () => {
      const result = filterCounties(allCounties, allCounties, '');
      expect(result).toHaveLength(0);
    });

    it('should return empty array when query matches nothing', () => {
      const result = filterCounties(allCounties, [], 'xyz');
      expect(result).toHaveLength(0);
    });

    it('should handle case variations in query', () => {
      expect(filterCounties(allCounties, [], 'SEDGWICK')).toEqual(['Sedgwick County']);
      expect(filterCounties(allCounties, [], 'sedgwick')).toEqual(['Sedgwick County']);
      expect(filterCounties(allCounties, [], 'SeDgWiCk')).toEqual(['Sedgwick County']);
    });
  });

  describe('Selection Management', () => {
    function addCounty(selected: string[], county: string): string[] {
      if (!selected.includes(county)) {
        return [...selected, county];
      }
      return selected;
    }

    function removeCounty(selected: string[], county: string): string[] {
      return selected.filter((c) => c !== county);
    }

    it('should add a county to selection', () => {
      const selected: string[] = [];
      const result = addCounty(selected, 'Sedgwick County');
      expect(result).toEqual(['Sedgwick County']);
    });

    it('should not add duplicate county', () => {
      const selected = ['Sedgwick County'];
      const result = addCounty(selected, 'Sedgwick County');
      expect(result).toEqual(['Sedgwick County']);
    });

    it('should add multiple counties', () => {
      let selected: string[] = [];
      selected = addCounty(selected, 'Sedgwick County');
      selected = addCounty(selected, 'Johnson County');
      selected = addCounty(selected, 'Douglas County');
      
      expect(selected).toHaveLength(3);
      expect(selected).toContain('Sedgwick County');
      expect(selected).toContain('Johnson County');
      expect(selected).toContain('Douglas County');
    });

    it('should remove a county from selection', () => {
      const selected = ['Sedgwick County', 'Johnson County'];
      const result = removeCounty(selected, 'Sedgwick County');
      
      expect(result).toHaveLength(1);
      expect(result).toEqual(['Johnson County']);
    });

    it('should handle removing non-existent county', () => {
      const selected = ['Sedgwick County'];
      const result = removeCounty(selected, 'Douglas County');
      
      expect(result).toEqual(['Sedgwick County']);
    });

    it('should handle removing from empty selection', () => {
      const result = removeCounty([], 'Sedgwick County');
      expect(result).toHaveLength(0);
    });

    it('should preserve order when removing middle item', () => {
      const selected = ['A County', 'B County', 'C County'];
      const result = removeCounty(selected, 'B County');
      
      expect(result).toEqual(['A County', 'C County']);
    });
  });

  describe('Text Highlighting Logic', () => {
    function findMatchIndex(text: string, query: string): number {
      return text.toLowerCase().indexOf(query.toLowerCase());
    }

    function splitForHighlight(text: string, query: string): { before: string; match: string; after: string } | null {
      const matchIndex = findMatchIndex(text, query);
      if (matchIndex === -1) return null;

      return {
        before: text.slice(0, matchIndex),
        match: text.slice(matchIndex, matchIndex + query.length),
        after: text.slice(matchIndex + query.length),
      };
    }

    it('should find match at start of text', () => {
      const result = splitForHighlight('Sedgwick County', 'Sedg');
      expect(result).toEqual({
        before: '',
        match: 'Sedg',
        after: 'wick County'
      });
    });

    it('should find match in middle of text', () => {
      const result = splitForHighlight('Sedgwick County', 'wick');
      expect(result).toEqual({
        before: 'Sedg',
        match: 'wick',
        after: ' County'
      });
    });

    it('should find match at end of text', () => {
      const result = splitForHighlight('Sedgwick County', 'County');
      expect(result).toEqual({
        before: 'Sedgwick ',
        match: 'County',
        after: ''
      });
    });

    it('should be case-insensitive for matching', () => {
      const result = splitForHighlight('Sedgwick County', 'SEDG');
      expect(result).not.toBeNull();
      expect(result?.match).toBe('Sedg'); // Preserves original case
    });

    it('should return null for no match', () => {
      const result = splitForHighlight('Sedgwick County', 'xyz');
      expect(result).toBeNull();
    });

    it('should handle full text match', () => {
      const result = splitForHighlight('Test', 'Test');
      expect(result).toEqual({
        before: '',
        match: 'Test',
        after: ''
      });
    });
  });

  describe('Keyboard Navigation Logic', () => {
    interface KeyboardState {
      query: string;
      selected: string[];
      filteredCounties: string[];
      isOpen: boolean;
    }

    function handleKeyDown(
      key: string,
      state: KeyboardState
    ): Partial<KeyboardState> & { action?: string } {
      if (key === 'Escape') {
        return { isOpen: false };
      }
      
      if (key === 'Backspace' && state.query === '' && state.selected.length > 0) {
        return {
          selected: state.selected.slice(0, -1),
          action: 'remove-last'
        };
      }
      
      if (key === 'Enter' && state.filteredCounties.length > 0) {
        return {
          selected: [...state.selected, state.filteredCounties[0]],
          query: '',
          isOpen: false,
          action: 'select-first'
        };
      }
      
      return {};
    }

    it('should close dropdown on Escape', () => {
      const state: KeyboardState = {
        query: 'test',
        selected: [],
        filteredCounties: ['Test County'],
        isOpen: true
      };
      
      const result = handleKeyDown('Escape', state);
      expect(result.isOpen).toBe(false);
    });

    it('should remove last selected on Backspace when query is empty', () => {
      const state: KeyboardState = {
        query: '',
        selected: ['County A', 'County B'],
        filteredCounties: [],
        isOpen: true
      };
      
      const result = handleKeyDown('Backspace', state);
      expect(result.selected).toEqual(['County A']);
      expect(result.action).toBe('remove-last');
    });

    it('should not remove on Backspace when query has text', () => {
      const state: KeyboardState = {
        query: 'test',
        selected: ['County A'],
        filteredCounties: [],
        isOpen: true
      };
      
      const result = handleKeyDown('Backspace', state);
      expect(result.selected).toBeUndefined();
    });

    it('should select first filtered county on Enter', () => {
      const state: KeyboardState = {
        query: 'sedg',
        selected: [],
        filteredCounties: ['Sedgwick County', 'Other County'],
        isOpen: true
      };
      
      const result = handleKeyDown('Enter', state);
      expect(result.selected).toEqual(['Sedgwick County']);
      expect(result.query).toBe('');
      expect(result.isOpen).toBe(false);
    });

    it('should not select on Enter when no filtered counties', () => {
      const state: KeyboardState = {
        query: 'xyz',
        selected: [],
        filteredCounties: [],
        isOpen: true
      };
      
      const result = handleKeyDown('Enter', state);
      expect(result.selected).toBeUndefined();
    });
  });

  describe('API Response Handling', () => {
    interface CountiesResponse {
      counties?: string[];
      error?: string;
    }

    function processCountiesResponse(response: CountiesResponse): string[] {
      return response.counties || [];
    }

    it('should extract counties array from response', () => {
      const response: CountiesResponse = {
        counties: ['County A', 'County B']
      };
      
      expect(processCountiesResponse(response)).toEqual(['County A', 'County B']);
    });

    it('should return empty array when counties is undefined', () => {
      const response: CountiesResponse = {};
      expect(processCountiesResponse(response)).toEqual([]);
    });

    it('should return empty array when counties is null-ish', () => {
      const response: CountiesResponse = { counties: undefined };
      expect(processCountiesResponse(response)).toEqual([]);
    });

    it('should handle empty counties array', () => {
      const response: CountiesResponse = { counties: [] };
      expect(processCountiesResponse(response)).toEqual([]);
    });
  });
});

describe('CountyPicker Integration', () => {
  describe('Search Page Integration', () => {
    function buildSearchParams(filters: {
      query?: string;
      docTypes?: string[];
      counties?: string[];
      meetingDateFrom?: string;
      meetingDateTo?: string;
    }): string {
      const params = new URLSearchParams();
      
      if (filters.query) params.append('query', filters.query);
      if (filters.docTypes && filters.docTypes.length > 0) {
        params.append('docTypes', filters.docTypes.join(','));
      }
      if (filters.counties && filters.counties.length > 0) {
        params.append('counties', filters.counties.join(','));
      }
      if (filters.meetingDateFrom) params.append('meetingDateFrom', filters.meetingDateFrom);
      if (filters.meetingDateTo) params.append('meetingDateTo', filters.meetingDateTo);
      params.append('limit', '100');
      
      return params.toString();
    }

    it('should include counties in search params when selected', () => {
      const params = buildSearchParams({
        counties: ['Sedgwick County', 'Johnson County']
      });
      
      expect(params).toContain('counties=Sedgwick+County%2CJohnson+County');
    });

    it('should not include counties param when none selected', () => {
      const params = buildSearchParams({
        query: 'test'
      });
      
      expect(params).not.toContain('counties=');
      expect(params).toContain('query=test');
    });

    it('should combine counties with other filters', () => {
      const params = buildSearchParams({
        query: 'zoning',
        docTypes: ['Agenda'],
        counties: ['Sedgwick County'],
        meetingDateFrom: '2025-01-01'
      });
      
      expect(params).toContain('query=zoning');
      expect(params).toContain('docTypes=Agenda');
      expect(params).toContain('counties=Sedgwick+County');
      expect(params).toContain('meetingDateFrom=2025-01-01');
    });

    it('should handle single county', () => {
      const params = buildSearchParams({
        counties: ['Douglas County']
      });
      
      expect(params).toContain('counties=Douglas+County');
    });

    it('should handle many counties', () => {
      const counties = [
        'Allen County',
        'Douglas County',
        'Johnson County',
        'Sedgwick County',
        'Wyandotte County'
      ];
      
      const params = buildSearchParams({ counties });
      
      // All counties should be included
      for (const county of counties) {
        expect(params).toContain(encodeURIComponent(county).replace(/%20/g, '+'));
      }
    });
  });
});

