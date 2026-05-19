export interface DesignSystemStory {
  id: string;
  title: string;
  storybookTitle: string;
  path: string;
}

export interface DesignSystemStoryGroup {
  id: string;
  title: string;
  description: string;
  stories: readonly DesignSystemStory[];
}

export const DESIGN_SYSTEM_STORYBOOK_PORT = 6006;
export const DESIGN_SYSTEM_STORYBOOK_URL = `http://127.0.0.1:${DESIGN_SYSTEM_STORYBOOK_PORT}`;
export const DESIGN_SYSTEM_STORYBOOK_COMMAND = 'npm --prefix frontend run storybook';
export const DESIGN_SYSTEM_SCREENSHOT_PATH =
  'docs-linhay/spaces/20260519-design-system-workbench/screenshots/20260519/design-system/20260519-design-system-storybook-web-after-v01.png';

export const designSystemStoryGroups = [
  {
    id: 'tokens',
    title: 'Tokens',
    description: 'Color, typography, spacing, border, and shadow tokens used by GetTokens UI.',
    stories: [
      {
        id: 'color-tokens',
        title: 'Color Tokens',
        storybookTitle: 'Design System/Tokens/Colors',
        path: 'frontend/src/stories/tokens/ColorTokens.stories.tsx',
      },
      {
        id: 'typography-tokens',
        title: 'Typography Tokens',
        storybookTitle: 'Design System/Tokens/Typography',
        path: 'frontend/src/stories/tokens/TypographyTokens.stories.tsx',
      },
    ],
  },
  {
    id: 'primitives',
    title: 'Primitives',
    description: 'Swiss base classes that define the product material language.',
    stories: [
      {
        id: 'swiss-primitives',
        title: 'Swiss Primitives',
        storybookTitle: 'Design System/Primitives/Swiss Primitives',
        path: 'frontend/src/stories/primitives/SwissPrimitives.stories.tsx',
      },
    ],
  },
  {
    id: 'components',
    title: 'Components',
    description: 'Reusable React components under frontend/src/components/ui.',
    stories: [
      {
        id: 'segmented-control',
        title: 'SegmentedControl',
        storybookTitle: 'Design System/Components/SegmentedControl',
        path: 'frontend/src/components/ui/SegmentedControl.stories.tsx',
      },
      {
        id: 'toggle-switch',
        title: 'ToggleSwitch',
        storybookTitle: 'Design System/Components/ToggleSwitch',
        path: 'frontend/src/components/ui/ToggleSwitch.stories.tsx',
      },
      {
        id: 'action-select',
        title: 'ActionSelect',
        storybookTitle: 'Design System/Components/ActionSelect',
        path: 'frontend/src/components/ui/ActionSelect.stories.tsx',
      },
      {
        id: 'combobox',
        title: 'Combobox',
        storybookTitle: 'Design System/Components/Combobox',
        path: 'frontend/src/components/ui/Combobox.stories.tsx',
      },
      {
        id: 'workspace-page-header',
        title: 'WorkspacePageHeader',
        storybookTitle: 'Design System/Components/WorkspacePageHeader',
        path: 'frontend/src/components/ui/WorkspacePageHeader.stories.tsx',
      },
      {
        id: 'page-loading-fallback',
        title: 'PageLoadingFallback',
        storybookTitle: 'Design System/Components/PageLoadingFallback',
        path: 'frontend/src/components/ui/PageLoadingFallback.stories.tsx',
      },
    ],
  },
] as const satisfies readonly DesignSystemStoryGroup[];

export function flattenDesignSystemStories(
  groups: readonly DesignSystemStoryGroup[] = designSystemStoryGroups,
): DesignSystemStory[] {
  return groups.flatMap((group) => [...group.stories]);
}

export function getDesignSystemStoryStats(
  groups: readonly DesignSystemStoryGroup[] = designSystemStoryGroups,
) {
  return {
    groupCount: groups.length,
    storyCount: flattenDesignSystemStories(groups).length,
  };
}
