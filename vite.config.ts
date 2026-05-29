import path from 'path';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import matter from 'gray-matter';
import type { Plugin } from 'vite';

function generateStoriesPlugin(): Plugin {
  const STORIES_DIR = path.resolve(__dirname, 'content/stories');
  const OUTPUT_FILE = path.resolve(__dirname, 'data/generatedStories.ts');

  function bodyToContent(raw: string): string[] {
    return raw
      .trim()
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => {
        const lines = p.split('\n');
        if (lines.every(l => l.startsWith('>'))) {
          const stripped = lines
            .map(l => (l.startsWith('> ') ? l.slice(2) : l.slice(1).trim()))
            .join('\n');
          return '> ' + stripped;
        }
        return p;
      });
  }

  function generate() {
    const files = readdirSync(STORIES_DIR).filter(f => f.endsWith('.md')).sort();
    const stories = files.map(file => {
      const raw = readFileSync(path.join(STORIES_DIR, file), 'utf-8');
      const { data: fm, content: body } = matter(raw);
      const slug = path.basename(file, '.md');
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
      };
    });
    stories.sort((a, b) => a._order - b._order);
    const output = stories.map(({ _order: _o, ...s }) => s);
    const fileContent = `// AUTO-GENERATED - do not edit. Source: content/stories/*.md
// Regenerated automatically by Vite on dev start, file change, and build.
import type { Story } from '../types'

export const STORIES: Story[] = ${JSON.stringify(output, null, 2)}
`;
    writeFileSync(OUTPUT_FILE, fileContent);
    console.log(`✓ Stories: generated ${output.length} → data/generatedStories.ts`);
  }

  return {
    name: 'generate-stories',
    buildStart() {
      generate();
    },
    configureServer(server) {
      server.watcher.add(STORIES_DIR);
      const onChange = (file: string) => {
        if (file.startsWith(STORIES_DIR) && file.endsWith('.md')) {
          generate();
          server.ws.send({ type: 'full-reload' });
        }
      };
      server.watcher.on('add', onChange);
      server.watcher.on('change', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}

function mockApiPlugin(): Plugin {
  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use('/api/inquire', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const { name, email, inquiryType, vision, commissionType } = data;
            if (!name || !email || (inquiryType !== 'purchase' && (!vision || !commissionType))) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Please fill in all required fields.' }));
              return;
            }
            console.log('\n[mock /api/inquire]', JSON.stringify(data, null, 2));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  server: {
    port: 8888,
    host: '0.0.0.0',
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
  plugins: [react(), generateStoriesPlugin(), mockApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@keystatic/')) return 'admin-keystatic';
          if (id.includes('/node_modules/@stripe/') || id.includes('/node_modules/stripe/')) return 'stripe';
          if (id.includes('/node_modules/lucide-react/')) return 'icons';
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
