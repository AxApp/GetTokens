import './style.css'
import App from './App.svelte'
import setupLocator from "@locator/runtime"

// 仅在开发环境下启用 LocatorJS
if (import.meta.env.MODE === 'development') {
  setupLocator({
    adapter: "svelte",
  })
}

const app = new App({
  target: document.getElementById('app'),
})

export default app
