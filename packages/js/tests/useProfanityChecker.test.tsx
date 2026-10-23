import { renderHook, act } from '@testing-library/react';

const mockFilterIsProfane = jest.fn();

// Mock the core functions to ensure we're testing the hook behavior
jest.mock('../src/core', () => ({
  checkProfanity: jest.fn(),
  checkProfanityAsync: jest.fn(),
}));

jest.mock('../src/core/filterPool', () => ({
  createFilterConfig: jest.fn((config?: unknown) => config ?? {}),
  getPooledFilter: jest.fn(() => ({
    isProfane: mockFilterIsProfane,
  })),
}));

// Mock React hooks
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn(),
  useCallback: jest.fn(),
}));

import { useProfanityChecker } from '../src/hooks/useProfanityChecker';
import { SeverityLevel, Language } from '../src/types/types';

// Get the mocked functions
const mockCheckProfanity = jest.mocked(require('../src/core').checkProfanity);
const mockCheckProfanityAsync = jest.mocked(require('../src/core').checkProfanityAsync);
const mockUseState = jest.mocked(require('react').useState);
const mockUseCallback = jest.mocked(require('react').useCallback);

describe('useProfanityChecker Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations for React hooks
    mockUseState.mockImplementation((initial: any) => [initial, jest.fn()]);
    mockUseCallback.mockImplementation((fn: any) => fn);
  });

  describe('Hook Initialization', () => {
    test('initializes with correct default state', () => {
      const { result } = renderHook(() => useProfanityChecker());
      
      expect(result.current.result).toBeNull();
      expect(result.current.isDirty).toBe(false);
      expect(typeof result.current.checkText).toBe('function');
      expect(typeof result.current.checkTextAsync).toBe('function');
      expect(typeof result.current.reset).toBe('function');
      expect(typeof result.current.isWordProfane).toBe('function');
    });

    test('accepts configuration parameter', () => {
      const config = { languages: ['english' as Language] };
      const { result } = renderHook(() => useProfanityChecker(config));
      
      expect(result.current).toBeDefined();
    });
  });

  describe('Text Checking', () => {
    test('calls checkProfanity with correct parameters', () => {
      mockCheckProfanity.mockReturnValue({
        containsProfanity: true,
        profaneWords: ['bad'],
        filteredWords: ['bad'],
        autoReplaced: 'clean text'
      });
      
      const { result } = renderHook(() => useProfanityChecker());
      
      act(() => {
        result.current.checkText('some bad text');
      });

      expect(mockCheckProfanity).toHaveBeenCalledWith('some bad text', undefined);
    });

    test('passes configuration to core function', () => {
      const config = { 
        languages: ['english' as Language], 
        autoReplace: true, 
        replaceWith: '***' 
      };
      
      mockCheckProfanity.mockReturnValue({
        containsProfanity: false,
        profaneWords: [],
        filteredWords: [],
        autoReplaced: 'clean text'
      });
      
      const { result } = renderHook(() => useProfanityChecker(config));
      
      act(() => {
        result.current.checkText('clean text');
      });

      expect(mockCheckProfanity).toHaveBeenCalledWith('clean text', config);
    });

    test('calls checkProfanityAsync with correct parameters', async () => {
      mockCheckProfanityAsync.mockResolvedValue({
        containsProfanity: true,
        profaneWords: ['bad'],
        filteredWords: ['bad'],
        autoReplaced: 'clean text'
      });
      
      const { result } = renderHook(() => useProfanityChecker());
      
      await act(async () => {
        await result.current.checkTextAsync('some bad text');
      });

      expect(mockCheckProfanityAsync).toHaveBeenCalledWith('some bad text', undefined);
    });
  });

  describe('Word Checking', () => {
    test('calls filter.isProfane for single-word checks', () => {
      mockFilterIsProfane.mockReturnValue(true);

      const { result } = renderHook(() => useProfanityChecker());

      act(() => {
        result.current.isWordProfane('badword');
      });

      expect(mockFilterIsProfane).toHaveBeenCalledWith('badword');
    });
  });

  describe('State Management', () => {
    test('reset clears the result', () => {
      const setResult = jest.fn();
      
      mockUseState.mockImplementation((initial: any) => [initial, setResult]);

      const { result } = renderHook(() => useProfanityChecker());
      
      act(() => {
        result.current.reset();
      });

      expect(setResult).toHaveBeenCalledWith(null);
    });

    test('isDirty reflects containsProfanity from result', () => {
      const mockResult = { containsProfanity: true, profaneWords: [], filteredWords: [], autoReplaced: '' };
      mockUseState.mockImplementation(() => [mockResult, jest.fn()]);

      const { result } = renderHook(() => useProfanityChecker());
      
      expect(result.current.isDirty).toBe(true);
    });
  });

  describe('Configuration Changes', () => {
    test('recreates callbacks when config changes', () => {
      const { result, rerender } = renderHook(
        ({ config }) => useProfanityChecker(config),
        { initialProps: { config: { languages: ['english' as Language] } } }
      );
      
      const originalCheckText = result.current.checkText;
      
      rerender({ config: { languages: ['spanish' as Language] } });
      
      // Callbacks should be different due to config change
      expect(result.current.checkText).not.toBe(originalCheckText);
    });
  });

  describe('Error Handling', () => {
    test('handles checkProfanity errors gracefully', () => {
      mockCheckProfanity.mockImplementation(() => {
        throw new Error('Test error');
      });

      const { result } = renderHook(() => useProfanityChecker());
      
      expect(() => {
        act(() => {
          result.current.checkText('test');
        });
      }).not.toThrow();
    });

    test('handles checkProfanityAsync errors gracefully', async () => {
      mockCheckProfanityAsync.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useProfanityChecker());
      
      await expect(async () => {
        await act(async () => {
          await result.current.checkTextAsync('test');
        });
      }).not.toThrow();
    });
  });
});