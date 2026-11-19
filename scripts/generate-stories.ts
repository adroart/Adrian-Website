import path from 'node:path';
import { generateStories } from './story-source';

const count = generateStories(path.resolve('content/stories'), path.resolve('data/generatedStories.ts'));
console.log(`Generated ${count} stories → data/generatedStories.ts`);
