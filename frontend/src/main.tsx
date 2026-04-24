import ReactDOM from 'react-dom/client';
import setupLocator from '@locator/runtime';
import App from './App';
import './style.css';

// 仅在开发环境下启用调试工具
if (import.meta.env.MODE === 'development') {
  console.log('!!! DEV_MODE: Enabling LocatorJS...');
  setupLocator({
    adapter: 'react',
  });
}

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('App root element #app was not found');
}

ReactDOM.createRoot(rootElement).render(<App />);
