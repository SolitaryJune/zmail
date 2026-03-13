import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// 创建路由器配置
const router = {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter {...router}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)