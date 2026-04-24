import './style.css'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import setupLocator from "@locator/runtime"

// 仅在开发环境下启用调试工具
if (import.meta.env.MODE === 'development') {
  console.log('!!! DEV_MODE: Enabling LocatorJS...');
  setupLocator({
    adapter: "react",
  })
}

ReactDOM.createRoot(document.getElementById('app')).render(
  <App />
)
