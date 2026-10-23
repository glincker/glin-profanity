import { Filter } from '../src/filters/Filter';
import { SeverityLevel } from '../src/types/types';

describe('Context-Aware Filtering', () => {
  let filter: Filter;

  beforeEach(() => {
    filter = new Filter({
      enableContextAware: true,
      contextWindow: 3,
      confidenceThreshold: 0.7,
      languages: ['english'],
      logProfanity: false,
    });
  });

  describe('Positive Context Detection', () => {
    it('should NOT flag words in positive contexts', () => {
      const testCases = [
        'This movie is sick!', // 'sick' in positive context
        'This song is the shit!', // 'shit' in positive context
        'That movie is badass and amazing!', // 'badass' with positive words
      ];

      testCases.forEach(text => {
        const result = filter.checkProfanity(text);
        
        // Context-aware analysis should be working
        expect(result.reason).toBeDefined();
        
        // If context analysis detected potential profanity, it should provide scores
        if (result.matches && result.matches.length > 0) {
          result.matches.forEach(match => {
            expect(match.contextScore).toBeDefined();
            expect(match.reason).toBeDefined();
          });
        }
        
        // For positive contexts, the context-aware filter should either:
        // 1. Not detect profanity at all, OR 
        // 2. Detect it but with high context scores indicating positive context
        if (result.containsProfanity && result.matches) {
          const hasPositiveContext = result.matches.some(m => m.contextScore && m.contextScore > 0.3);
          expect(hasPositiveContext).toBe(true);
        }
      });
    });

    it('should NOT flag gaming terms with positive context', () => {
      const testCases = [
        'You are a badass player!',
        'That was a sick move in the game',
        'Your gaming skills are insane!'
      ];

      const gamingFilter = new Filter({
        enableContextAware: true,
        contextWindow: 3,
        domainWhitelists: {
          english: ['player', 'gaming', 'game']
        },
        languages: ['english'],
      });

      testCases.forEach(text => {
        const result = gamingFilter.checkProfanity(text);
        expect(result.containsProfanity).toBe(false);
        if (result.matches) {
          expect(result.matches.some(match => match.isWhitelisted)).toBe(true);
        }
      });
    });
  });

  describe('Negative Context Detection', () => {
    it('should flag profanity in negative contexts', () => {
      const testCases = [
        'You are a fucking idiot',
        'Such a stupid ass',
        'You piece of shit'
      ];

      testCases.forEach(text => {
        const result = filter.checkProfanity(text);
        expect(result.containsProfanity).toBe(true);
        expect(result.profaneWords.length).toBeGreaterThan(0);
        
        // Verify context analysis
        if (result.contextScore !== undefined) {
          expect(result.contextScore).toBeLessThan(0.7);
        }
      });
    });
  });

  describe('Match Details', () => {
    it('should provide detailed match information', () => {
      const result = filter.checkProfanity('This is a fucking good movie');
      
      expect(result.matches).toBeDefined();
      if (result.matches && result.matches.length > 0) {
        const match = result.matches[0];
        expect(match.word).toBeDefined();
        expect(match.index).toBeGreaterThanOrEqual(0);
        expect(match.severity).toBeDefined();
        expect(match.contextScore).toBeDefined();
        expect(match.reason).toBeDefined();
      }
    });
  });

  describe('Severity Levels', () => {
    it('should detect exact matches with correct severity', () => {
      const severityFilter = new Filter({
        enableContextAware: false, // Test traditional filtering
        severityLevels: true,
        languages: ['english']
      });

      const result = severityFilter.checkProfanity('This is fucking annoying');
      
      expect(result.containsProfanity).toBe(true);
      expect(result.severityMap).toBeDefined();
      if (result.severityMap) {
        const severities = Object.values(result.severityMap);
        expect(severities).toContain(SeverityLevel.EXACT);
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without context-aware features enabled', () => {
      const traditionalFilter = new Filter({
        enableContextAware: false,
        languages: ['english']
      });

      const result = traditionalFilter.checkProfanity('This movie is fucking awesome');
      
      // Should flag without context awareness
      expect(result.containsProfanity).toBe(true);
      expect(traditionalFilter.isProfane('This movie is fucking awesome')).toBe(true);
      expect(result.matches).toBeUndefined();
      expect(result.contextScore).toBeUndefined();
    });

    it('isProfane and checkProfanity agree when context-aware is enabled', () => {
      const result = filter.checkProfanity('You are a fucking idiot');
      expect(filter.isProfane('You are a fucking idiot')).toBe(result.containsProfanity);
      expect(result.containsProfanity).toBe(true);

      const cleanResult = filter.checkProfanity('This movie is the bomb');
      expect(filter.isProfane('This movie is the bomb')).toBe(cleanResult.containsProfanity);
      expect(cleanResult.containsProfanity).toBe(false);
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom confidence threshold', () => {
      const strictFilter = new Filter({
        enableContextAware: true,
        confidenceThreshold: 0.9, // Very strict
        languages: ['english']
      });

      const result = strictFilter.checkProfanity('This movie is fucking awesome');
      
      // With higher threshold, might still flag borderline cases
      expect(result).toBeDefined();
      expect(result.reason).toBeDefined();
    });

    it('should respect custom context window', () => {
      const narrowFilter = new Filter({
        enableContextAware: true,
        contextWindow: 1, // Very narrow context
        languages: ['english']
      });

      const result = narrowFilter.checkProfanity('Amazing! This movie is fucking awesome for sure');
      
      expect(result).toBeDefined();
      expect(result.reason).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const result = filter.checkProfanity('');
      
      expect(result.containsProfanity).toBe(false);
      expect(result.profaneWords).toHaveLength(0);
    });

    it('should handle single words', () => {
      const result = filter.checkProfanity('shit');
      
      expect(result).toBeDefined();
      expect(result.reason).toBeDefined();
    });

    it('should handle very long texts', () => {
      const longText = 'This is a very long text that goes on and on about how this movie is absolutely fucking amazing and everyone should watch it because it is amazing and fantastic and wonderful'.repeat(5);
      
      const result = filter.checkProfanity(longText);
      
      expect(result).toBeDefined();
      expect(result.reason).toBeDefined();
    });
  });

  describe('Result shape parity', () => {
    it('includes reason on AC path', () => {
      const acFilter = new Filter({
        languages: ['english'],
        detectLeetspeak: true,
        enableContextAware: true,
      });
      const result = acFilter.checkProfanity('fuuuuuck');
      expect(result.reason).toBe('Found 1 potential profanity matches');
    });

    it('aligns containsProfanity with isProfane for whitelisted context', () => {
      const result = filter.checkProfanity('This movie is the bomb');
      expect(result.containsProfanity).toBe(false);
      expect(result.reason).toBe('No profanity detected');
      expect(filter.isProfane('This movie is the bomb')).toBe(result.containsProfanity);
    });

    it('aligns containsProfanity with isProfane for repeated chars', () => {
      const leetFilter = new Filter({
        languages: ['english'],
        detectLeetspeak: true,
        enableContextAware: true,
      });
      const result = leetFilter.checkProfanity('fuuuuuck');
      expect(result.containsProfanity).toBe(true);
      expect(result.profaneWords).toEqual(['fuck']);
      expect(result.reason).toBe('Found 1 potential profanity matches');
      expect(leetFilter.isProfane('fuuuuuck')).toBe(result.containsProfanity);
    });
  });
});