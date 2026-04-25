/**
 * Reads content/stories/*.md and writes data/generatedStories.ts.
 * Run before the Vite build so components can import STORIES statically.
 */
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const STORIES_DIR = path.join(process.cwd(), 'content/stories')
const OUTPUT_FILE = path.join(process.cwd(), 'data/generatedStories.ts')

function bodyToContent(raw: string): string[] {
  return raw
    .trim()
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const lines = p.split('\n')
      // Multi-line blockquote: strip the ">" prefix from every line, rejoin with \n,
      // then store as a single "> text" string so Writings.tsx renders it as one pull quote
      // with whitespace-pre-line preserving the line breaks.
      if (lines.every(l => l.startsWith('>'))) {
        const stripped = lines.map(l => l.startsWith('> ') ? l.slice(2) : l.slice(1).trim()).join('\n')
        return '> ' + stripped
      }
      return p
    })
}

const files = fs
  .readdirSync(STORIES_DIR)
  .filter(f => f.endsWith('.md'))
  .sort()

const stories = files.map(file => {
  const raw = fs.readFileSync(path.join(STORIES_DIR, file), 'utf-8')
  const { data: fm, content: body } = matter(raw)
  const slug = path.basename(file, '.md')

  return {
    id: slug,
    slug,
    title: fm.title as string,
    subtitle: fm.subtitle as string | undefined,
    date: fm.date as string,
    category: fm.category as string,
    excerpt: fm.excerpt as string,
    content: bodyToContent(body),
    image: fm.image as string | undefined,
    readMinutes: fm.readMinutes as number,
    tags: (fm.tags ?? []) as string[],
    isFeatured: (fm.isFeatured ?? false) as boolean,
    relatedArtifactId: fm.relatedArtifactId as string | undefined,
    tracks: fm.tracks as { title: string; url: string; duration?: string }[] | undefined,
    lyrics: fm.lyrics as string[] | undefined,
    _order: (fm.order ?? 999) as number,
  }
})

// Sort by the optional `order` frontmatter field
stories.sort((a, b) => a._order - b._order)

// Strip the internal _order field before writing
const output = stories.map(({ _order: _o, ...s }) => s)

const fileContent = `// AUTO-GENERATED - do not edit. Source: content/stories/*.md
// Regenerate: npm run generate:stories
import type { Story } from '../types'

export const STORIES: Story[] = ${JSON.stringify(output, null, 2)}
`

fs.writeFileSync(OUTPUT_FILE, fileContent)
console.log(`Generated ${output.length} stories → data/generatedStories.ts`)
