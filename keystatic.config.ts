import { config, collection, fields } from '@keystatic/core'

export default config({
  storage: {
    kind: 'github',
    repo: {
      owner: 'adroart',
      name: 'Adrian-Website',
    },
  },

  collections: {
    stories: collection({
      label: 'Stories',
      slugField: 'title',
      path: 'content/stories/*',
      format: { contentField: 'body' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),

        subtitle: fields.text({
          label: 'Subtitle',
          validation: { isRequired: false },
        }),

        date: fields.text({
          label: 'Date',
          description: 'e.g. "Winter 2024" or "Spring 2025"',
        }),

        category: fields.select({
          label: 'Category',
          options: [
            { label: 'Living Knowledge', value: 'Living Knowledge' },
            { label: 'Beneath the Surface', value: 'Beneath the Surface' },
            { label: 'The Practice', value: 'The Practice' },
            { label: 'The Path', value: 'The Path' },
          ],
          defaultValue: 'Living Knowledge',
        }),

        excerpt: fields.text({
          label: 'Excerpt',
          description: 'Short preview shown on the writings listing page.',
          multiline: true,
        }),

        image: fields.text({
          label: 'Cover image',
          description: 'Cloudinary public ID (e.g. "Ye-ming-zhu_sfkatw").',
          validation: { isRequired: false },
        }),

        readMinutes: fields.number({
          label: 'Read time (minutes)',
          validation: { isRequired: true, min: 1 },
        }),

        tags: fields.array(
          fields.text({ label: 'Tag' }),
          { label: 'Tags', itemLabel: props => props.value ?? 'Tag' }
        ),

        isFeatured: fields.checkbox({
          label: 'Feature on home page',
          defaultValue: false,
        }),

        order: fields.number({
          label: 'Sort order',
          description: 'Lower numbers appear first in listings.',
          validation: { isRequired: false },
        }),

        relatedArtifactId: fields.text({
          label: 'Related artwork ID',
          validation: { isRequired: false },
        }),

        tracks: fields.array(
          fields.object({
            title: fields.text({ label: 'Track title' }),
            url: fields.text({ label: 'Audio URL (R2 direct link)' }),
            duration: fields.text({
              label: 'Duration',
              description: 'e.g. "4:12" — optional',
              validation: { isRequired: false },
            }),
          }),
          { label: 'Audio tracks', itemLabel: props => props.fields.title.value || 'Track' }
        ),

        body: fields.document({
          label: 'Content',
          formatting: {
            inlineMarks: { bold: true, italic: true },
            blockTypes: { blockquote: true },
            headingLevels: [2, 3],
            listTypes: { unordered: true, ordered: true },
            softBreaks: true,
          },
          links: true,
        }),
      },
    }),
  },
})
