import ReactDOM from 'react-dom/client';
import App from './App';
import { initDesignSystemInspectMode } from './features/design-system/inspectMode';
import './style.css';

// 仅在开发环境下启用节点检查与复制工具
if (import.meta.env.DEV) {
  initDesignSystemInspectMode();
}

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('App root element #app was not found');
}

ReactDOM.createRoot(rootElement).render(<App />);
