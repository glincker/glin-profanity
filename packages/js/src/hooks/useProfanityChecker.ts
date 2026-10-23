import { useState, useCallback, useRef, useEffect } from 'react';
import { checkProfanity, checkProfanityAsync } from '../core';
import { getPooledFilter } from '../core/filterPool';
import type { ProfanityCheckerConfig } from '../core/types';
import type { CheckProfanityResult } from '../types/types';

export type { ProfanityCheckerConfig };

export const useProfanityChecker = (config?: ProfanityCheckerConfig) => {
  const [result, setResult] = useState<CheckProfanityResult | null>(null);
  const filterRef = useRef(getPooledFilter(config));

  useEffect(() => {
    filterRef.current = getPooledFilter(config);
  }, [config]);

  const checkText = useCallback((text: string) => {
    const checkResult = checkProfanity(text, config);
    setResult(checkResult);
    return checkResult;
  }, [config]);

  const checkTextAsync = useCallback(async (text: string) => {
    const checkResult = await checkProfanityAsync(text, config);
    setResult(checkResult);
    return checkResult;
  }, [config]);

  const isWordProfaneCallback = useCallback((word: string) => {
    return filterRef.current.isProfane(word);
  }, []);

  const reset = useCallback(() => setResult(null), []);

  return {
    result,
    checkText,
    checkTextAsync,
    reset,
    isDirty: result?.containsProfanity ?? false,
    isWordProfane: isWordProfaneCallback,
  };
};
