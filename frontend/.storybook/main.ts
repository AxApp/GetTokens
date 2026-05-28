import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../src/stories/tokens/**/*.stories.@(ts|tsx|mdx)',
    '../src/stories/primitives/**/*.stories.@(ts|tsx|mdx)',
    '../src/components/ui/**/*.stories.@(ts|tsx|mdx)',
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-themes'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: true,
  },
};

export default config;
