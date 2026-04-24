import ReactDOM from 'react-dom/client';
import { initInspector } from '@linhey/react-debug-inspector';
import App from './App';
import './style.css';

// 仅在开发环境下启用节点检查与复制工具
if (import.meta.env.DEV) {
  initInspector();
}

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('App root element #app was not found');
}

ReactDOM.createRoot(rootElement).render(<App />);
