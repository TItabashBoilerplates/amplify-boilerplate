import boundaries from 'eslint-plugin-boundaries'

/**
 * FSD Layer Hierarchy (top to bottom):
 * app > views > widgets > features > entities > shared
 *
 * Import rules: Each layer can only import from layers below it.
 * Same-slice imports are always allowed.
 */

const FSD_ELEMENTS = [
  // Next.js App Router (at project root) - treated as top-level entry point
  { type: 'nextjs-app', pattern: 'app/**/*', mode: 'full' },
  // FSD layers (inside src/)
  { type: 'fsd-app', pattern: 'src/app/**/*', mode: 'full' },
  {
    type: 'views',
    pattern: 'src/views/*',
    mode: 'folder',
    capture: ['slice'],
  },
  {
    type: 'widgets',
    pattern: 'src/widgets/*',
    mode: 'folder',
    capture: ['slice'],
  },
  // @x cross-imports for features (must be before features to match first)
  {
    type: 'features-cross-import',
    pattern: 'src/features/*/@x/*',
    mode: 'full',
    capture: ['sourceSlice', 'targetSlice'],
  },
  {
    type: 'features',
    pattern: 'src/features/*',
    mode: 'folder',
    capture: ['slice'],
  },
  // @x cross-imports for entities (must be before entities to match first)
  {
    type: 'entities-cross-import',
    pattern: 'src/entities/*/@x/*',
    mode: 'full',
    capture: ['sourceSlice', 'targetSlice'],
  },
  {
    type: 'entities',
    pattern: 'src/entities/*',
    mode: 'folder',
    capture: ['slice'],
  },
  {
    type: 'shared',
    pattern: 'src/shared/*',
    mode: 'folder',
    capture: ['segment'],
  },
  // Workspace packages (always allowed)
  { type: 'workspace', pattern: '@workspace/**' },
]

const LAYER_RULES = [
  // Next.js App Router can import from all FSD layers
  {
    from: 'nextjs-app',
    allow: ['fsd-app', 'views', 'widgets', 'features', 'entities', 'shared', 'workspace'],
  },
  // FSD app layer can import from itself and all lower layers
  {
    from: 'fsd-app',
    allow: ['fsd-app', 'views', 'widgets', 'features', 'entities', 'shared', 'workspace'],
  },
  {
    from: 'views',
    allow: ['widgets', 'features', 'entities', 'shared', 'workspace'],
  },
  {
    from: 'widgets',
    allow: ['features', 'entities', 'shared', 'workspace'],
  },
  {
    from: 'features',
    allow: ['entities', 'shared', 'workspace'],
  },
  {
    from: 'entities',
    allow: ['shared', 'workspace'],
  },
  // Shared layer can import from any segment within shared (and workspace)
  {
    from: 'shared',
    allow: ['shared', 'workspace'],
  },
  // Allow same-slice imports (intra-slice) for sliced layers
  {
    from: ['views', 'widgets', 'features', 'entities'],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: eslint-plugin-boundaries syntax
    allow: [['views', { slice: '${from.slice}' }]],
  },
  {
    from: ['views', 'widgets', 'features', 'entities'],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: eslint-plugin-boundaries syntax
    allow: [['widgets', { slice: '${from.slice}' }]],
  },
  {
    from: ['views', 'widgets', 'features', 'entities'],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: eslint-plugin-boundaries syntax
    allow: [['features', { slice: '${from.slice}' }]],
  },
  {
    from: ['views', 'widgets', 'features', 'entities'],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: eslint-plugin-boundaries syntax
    allow: [['entities', { slice: '${from.slice}' }]],
  },
]

/**
 * FSD ESLint configuration for eslint-plugin-boundaries
 * @see https://github.com/javierbrea/eslint-plugin-boundaries
 */
export const fsdConfig = {
  plugins: {
    boundaries,
  },
  settings: {
    'boundaries/include': ['src/**/*', 'app/**/*'],
    'boundaries/elements': FSD_ELEMENTS,
  },
  rules: {
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: LAYER_RULES,
      },
    ],
    'boundaries/no-unknown': ['warn'],
  },
}

export default fsdConfig
