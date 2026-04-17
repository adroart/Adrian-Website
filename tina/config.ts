import { defineConfig } from 'tinacms'

export default defineConfig({
  branch: process.env.GITHUB_BRANCH ?? 'main',
  clientId: process.env.TINA_PUBLIC_CLIENT_ID ?? null,
  token: process.env.TINA_TOKEN ?? null,
  build: {
    outputFolder: 'admin',
    publicFolder: 'public',
  },
  media: {
    tina: {
      mediaRoot: '',
      publicFolder: 'public',
    },
  },
  schema: {
    collections: [
      {
        name: 'story',
        label: 'Stories',
        path: 'content/stories',
        format: 'md',
        ui: {
          filename: {
            slugify: (values) =>
              (values?.title as string | undefined)
                ?.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '') ?? 'untitled',
          },
        },
        fields: [
          {
            type: 'string',
            name: 'title',
            label: 'Title',
            isTitle: true,
            required: true,
          },
          {
            type: 'string',
            name: 'subtitle',
            label: 'Subtitle',
          },
          {
            type: 'string',
            name: 'date',
            label: 'Date (e.g. "Winter 2024")',
            required: true,
          },
          {
            type: 'string',
            name: 'category',
            label: 'Category',
            required: true,
            options: [
              'Living Knowledge',
              'Beneath the Surface',
              'The Practice',
              'The Path',
            ],
          },
          {
            type: 'string',
            name: 'excerpt',
            label: 'Excerpt',
            required: true,
            ui: { component: 'textarea' },
          },
          {
            type: 'string',
            name: 'image',
            label: 'Cover image (Cloudinary public ID)',
          },
          {
            type: 'number',
            name: 'readMinutes',
            label: 'Read time (minutes)',
            required: true,
          },
          {
            type: 'string',
            name: 'tags',
            label: 'Tags',
            list: true,
          },
          {
            type: 'boolean',
            name: 'isFeatured',
            label: 'Featured on home page',
          },
          {
            type: 'number',
            name: 'order',
            label: 'Sort order',
          },
          {
            type: 'string',
            name: 'relatedArtifactId',
            label: 'Related artwork ID',
          },
          {
            type: 'rich-text',
            name: 'body',
            label: 'Content',
            isBody: true,
          },
        ],
      },
    ],
  },
})
