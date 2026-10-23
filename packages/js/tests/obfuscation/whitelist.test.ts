import { makeFilter } from './helpers';

describe('interval whitelist', () => {
  const filter = makeFilter();

  it.each([
    'cl@ss starts at 5',
    'gl@ss of water',
    'gr@ss is green',
    'm@ss transit',
    'b@ss guitar',
    'ass﻿istant',
    'my ass​istant called',
    'summa cum laude',
    'He graduated magna cum laude',
    'Twatt, Orkney',
    'pussy willow',
    'a great tit sat on the feeder',
    'blue tit nest box',
    'cock the hammer back',
  ])('does not flag %s', (input) => {
    expect(filter.isProfane(input)).toBe(false);
    expect(filter.checkProfanity(input).containsProfanity).toBe(false);
  });

  it.each([
    'Dick Van Dyke',
    'Dick Tracy',
    'Moby Dick is a novel',
    'Philip K. Dick',
    'Dick Grayson is Robin',
    'Rick Astley and Dick Clark',
  ])('treats the name in %s as a name', (input) => {
    expect(filter.isProfane(input)).toBe(false);
  });

  it.each([
    'you are a dick',
    'dick',
    'What a dick move',
    'Shut up, you Dick Head',
    'stop being a dick, Dave',
    'you cum on my face',
    'ass',
    'you ass​hole',
    'a$$ and @ss',
  ])('still flags %s', (input) => {
    expect(filter.isProfane(input)).toBe(true);
  });

  it('only drops the overlapping hit, not others in the same text', () => {
    const result = filter.checkProfanity('Moby Dick and a real shit');
    expect(result.profaneWords).toEqual(['shit']);
  });

  it('keeps the dictionary itself intact', () => {
    expect(filter.getWordCount()).toBeGreaterThan(400);
    expect(filter.isProfane('dick')).toBe(true);
  });

  it('accepts extra safe phrases', () => {
    const custom = makeFilter({ whitelist: ['shit happens', 'Bastard Coffee'] });
    expect(custom.isProfane('well, shit happens')).toBe(false);
    expect(custom.isProfane('Bastard Coffee opens at nine')).toBe(false);
    expect(custom.isProfane('this is shit')).toBe(true);
  });

  it('can drop the built-in list', () => {
    const strict = makeFilter({ obfuscation: { builtinWhitelist: false } });
    expect(strict.isProfane('cl@ss starts at 5')).toBe(true);
  });

  it('applies to the context-aware path too', () => {
    const aware = makeFilter({ enableContextAware: true });
    expect(aware.checkProfanity('cl@ss starts at 5').containsProfanity).toBe(false);
  });
});
