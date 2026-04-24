import './style.css'
import App from './App.svelte'

console.log('!!! ENTRY: main.js execution started');

const app = new App({
  target: document.getElementById('app'),
})

console.log('!!! ENTRY: app instance created');

export default app
