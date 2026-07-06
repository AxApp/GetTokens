import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import { initInspector } from '@linhey/react-debug-inspector';

if (import.meta.env.DEV) {
  initInspector();
}

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('App root element #app was not found');
}

ReactDOM.createRoot(rootElement).render(<App />);
