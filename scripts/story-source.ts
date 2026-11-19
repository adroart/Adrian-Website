import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Markdoc, { type RenderableTreeNode } from '@markdoc/markdoc';
import matter from 'gray-matter';
import type { Story, StoryBodyNode } from '../types';

const editorTags = new Set(['p', 'h2', 'h3', 'blockquote', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br']);

export function isStoryFile(file: string) {
  return /\.m(?:d|doc)$/.test(file);
}

function plainParagraphs(raw: string) {
  return raw.trim().split(/\n{2,}/).map(paragraph => paragraph.trim()).filter(Boolean).map(paragraph => {
    const lines = paragraph.split('\n');
    return lines.every(line => line.startsWith('>'))
      ? `> ${lines.map(line => line.startsWith('> ') ? line.slice(2) : line.slice(1).trim()).join('\n')}`
      : paragraph;
  });
}

function safeStoryHref(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const href = value.trim();
  if (!href || /[\\\s\u0000-\u001f\u007f]/u.test(href) || href.startsWith('//')) return undefined;
  const scheme = href.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
  return !scheme || ['https', 'http', 'mailto'].includes(scheme) ? href : undefined;
}

function storyNodes(node: RenderableTreeNode): StoryBodyNode[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(storyNodes);
  if (!Markdoc.Tag.isTag(node)) return [];
  const children = node.children.flatMap(storyNodes);
  if (!editorTags.has(node.name)) return children;
  const tag = node.name as Exclude<StoryBodyNode, string>['tag'];
  if (tag === 'a') {
    const href = safeStoryHref(node.attributes.href);
    return href ? [{ tag, href, children }] : children;
  }
  if (tag === 'ol' && Number.isSafeInteger(node.attributes.start)) return [{ tag, start: node.attributes.start, children }];
  return [{ tag, children }];
}

function formattedContent(raw: string) {
  const nodes = storyNodes(Markdoc.transform(Markdoc.parse(raw)));
  // The legacy prose is intentionally left intact. The structured rendering is
  // used only where there is formatting beyond paragraphs and pull quotes.
  const requiresFormatting = (node: StoryBodyNode): boolean => typeof node !== 'string'
    && ((!['p', 'blockquote'].includes(node.tag)) || node.children.some(requiresFormatting));
  return nodes.some(requiresFormatting) ? nodes : undefined;
}

export function loadStories(directory: string): Story[] {
  const slugs = new Map<string, string>();
  const stories = readdirSync(directory).filter(isStoryFile).sort().map(file => {
    const slug = path.basename(file, path.extname(file));
    const existing = slugs.get(slug);
    if (existing) throw new Error(`Duplicate story slug "${slug}" in ${existing} and ${file}. Keep one story file for this public URL.`);
    slugs.set(slug, file);
    const { data, content: body } = matter(readFileSync(path.join(directory, file), 'utf-8'));
    const story: Story = {
      id: slug,
      slug,
      title: data.title,
      subtitle: data.subtitle,
      date: data.date,
      category: data.category,
      excerpt: data.excerpt,
      content: plainParagraphs(body),
      formattedContent: formattedContent(body),
      image: data.image,
      readMinutes: data.readMinutes,
      tags: data.tags ?? [],
      isFeatured: data.isFeatured ?? false,
      relatedArtifactId: typeof data.relatedArtifactId === 'string' ? data.relatedArtifactId.trim() || undefined : undefined,
      tracks: data.tracks,
      lyrics: data.lyrics,
    };
    return { story, order: data.order ?? 999 };
  });
  return stories.sort((a, b) => a.order - b.order).map(({ story }) => story);
}

export function generateStories(directory: string, outputFile: string) {
  const stories = loadStories(directory);
  const output = `// AUTO-GENERATED - do not edit. Source: content/stories/*.md and *.mdoc
// Regenerate: npm run generate:stories
import type { Story } from '../types'

export const STORIES: Story[] = ${JSON.stringify(stories, null, 2)}
`;
  writeFileSync(outputFile, output);
  return stories.length;
}
