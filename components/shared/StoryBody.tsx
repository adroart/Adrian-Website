import React from 'react';
import type { Artwork, Story, StoryBodyNode } from '../../types';

const classes: Partial<Record<Exclude<StoryBodyNode, string>['tag'], string>> = {
    p: 'mb-6',
    h2: 'mt-10 mb-4 font-title text-3xl leading-snug',
    h3: 'mt-8 mb-3 font-title text-2xl leading-snug',
    blockquote: 'pull-quote my-10 text-2xl md:text-3xl text-wood-600 font-title leading-relaxed whitespace-pre-line',
    ul: 'list-disc pl-6 mb-6',
    ol: 'list-decimal pl-6 mb-6',
    li: 'mb-1',
    a: 'text-bronze-700 underline underline-offset-2 hover:text-bronze-900',
};

function renderStoryNode(node: StoryBodyNode, key: number): React.ReactNode {
    if (typeof node === 'string') return node;
    const props = { key, className: classes[node.tag], href: node.href, start: node.start };
    if (node.tag === 'br') return <br key={key} />;
    return React.createElement(node.tag, props, node.children.map(renderStoryNode));
}

export function storyLinksArtwork(story: Pick<Story, 'slug' | 'relatedArtifactId'>, art: Pick<Artwork, 'id' | 'relatedStorySlug'>) {
    return story.relatedArtifactId === art.id || art.relatedStorySlug === story.slug;
}

export function StoryBody({ story }: { story: Story }) {
    if (story.formattedContent) return <>{story.formattedContent.map(renderStoryNode)}</>;
    return <>{story.content.map((paragraph, index) => (
        <React.Fragment key={index}>
            {index > 0 && index % 4 === 0 && story.content.length > 6 && (
                <div className="flex justify-center py-4 not-prose">
                    <span className="text-bronze-600 tracking-[0.5em] text-xs select-none" aria-hidden="true">···</span>
                </div>
            )}
            {paragraph.startsWith('> ') ? (
                <blockquote className={classes.blockquote}>{paragraph.slice(2)}</blockquote>
            ) : (
                <p className={classes.p}>{paragraph}</p>
            )}
        </React.Fragment>
    ))}</>;
}
