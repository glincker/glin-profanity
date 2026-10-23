import { DictionaryIndex } from './dictionaryIndex';
import { Edit, Transformer, applyEdits } from './mapped';

const TOKEN = /[\p{L}\p{N}]+/gu;
const HAS_REPEAT = /(.)\1/u;

/**
 * Collapses stretched words (aaaasshole, assholeeee, aasssshhoollee) to their
 * dictionary word. Run on already leet-normalized text.
 */
export function stretchTransformer(index: DictionaryIndex): Transformer {
  return (input) => {
    if (!HAS_REPEAT.test(input.text)) return input;
    const edits: Edit[] = [];
    const re = new RegExp(TOKEN.source, TOKEN.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(input.text)) !== null) {
      if (match[0].length < 4) continue;
      const word = index.resolveStretched(match[0]);
      if (word) {
        edits.push({ start: match.index, end: match.index + match[0].length, replacement: word });
      }
    }
    return applyEdits(input, edits);
  };
}
