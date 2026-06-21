import { type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import { buildGetTokensAntdTheme } from './antdTheme';

export function GetTokensAntdThemeProvider({ children }: { children?: ReactNode }) {
  return (
    <ConfigProvider theme={buildGetTokensAntdTheme()}>
      {children}
    </ConfigProvider>
  );
}
