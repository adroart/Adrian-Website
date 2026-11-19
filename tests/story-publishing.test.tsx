import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createReader } from '@keystatic/core/reader';
import config from '../keystatic.config';
import { loadStories } from '../scripts/story-source';
import { StoryBody, storyLinksArtwork } from '../components/shared/StoryBody';
import { readFileSync } from 'node:fs';

const header = `---
title: Editor fixture
date: Spring 2026
category: The Practice
excerpt: An unpublished test story.
readMinutes: 2
relatedArtifactId: UL-102
---
`;

const body = `## Working notes

A **bold** word and an *emphasis*.

- [Reference](https://example.test/notes)
- Another item

> A line of the quote
`;

test('the editor and public generator read the same story, including formatting and artwork links', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'adrian-stories-'));
    try {
        const { mkdir } = await import('node:fs/promises');
        const stories = path.join(directory, 'content/stories');
        await mkdir(stories, { recursive: true });
        const extension = config.collections.stories.schema.body.contentExtension;
        assert.equal(extension, '.md', 'existing published Markdown remains editable');
        await writeFile(path.join(stories, `editor-fixture${extension}`), `${header}\n${body}`);
        const editorStory = await createReader(directory, config).collections.stories.read('editor-fixture');
        assert.equal(editorStory?.title, 'Editor fixture');
        await editorStory?.body();
        const [story] = loadStories(stories);
        assert.equal(story.slug, 'editor-fixture');
        const html = renderToStaticMarkup(<StoryBody story={story} />);
        for (const pattern of [/<h2[^>]*>Working notes<\/h2>/, /<strong[^>]*>bold<\/strong>/, /<em[^>]*>emphasis<\/em>/, /<ul[\s\S]*<li[\s\S]*href="https:\/\/example.test\/notes"/, /<blockquote[\s\S]*A line of the quote/]) {
            assert.match(html, pattern);
        }
        assert.equal(storyLinksArtwork(story, { id: 'UL-102' }), true);
        assert.equal(storyLinksArtwork(story, { id: 'UL-103' }), false);
        assert.equal(storyLinksArtwork(story, { id: 'UL-104', relatedStorySlug: story.slug }), true);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('the generator preserves every existing story URL and paragraph body', () => {
    const generated = loadStories(path.resolve('content/stories'));
    const legacy = JSON.parse(readFileSync(new URL('./shared/story-legacy-bodies.json', import.meta.url), 'utf8'));
    assert.deepEqual(Object.fromEntries(generated.map(story => [story.slug, story.content])), legacy);
});

test('Markdoc files support safe formatting and reject duplicate public URLs', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'adrian-stories-'));
    try {
        await writeFile(path.join(directory, 'fixture.mdoc'), `${header}\n## Notes\n\n[Unsafe](javascript:alert) and [Safe](https://example.test).`);
        const [story] = loadStories(directory);
        const html = renderToStaticMarkup(<StoryBody story={story} />);
        assert.match(html, /<h2/);
        assert.match(html, /href="https:\/\/example.test"/);
        assert.doesNotMatch(html, /href="javascript:/);
        await writeFile(path.join(directory, 'fixture.md'), `${header}\nOther version`);
        assert.throws(() => loadStories(directory), /Duplicate story slug/);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
