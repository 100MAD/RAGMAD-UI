import { XProvider } from '@ant-design/x'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp } from 'antd'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { client } from './client/client.gen.ts'
import './index.css'

client.setConfig({ baseUrl: '/api' })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="app-shell">
      <XProvider
        theme={{
          token: {
            colorPrimary: '#1f4d45',
            colorInfo: '#1f4d45',
            colorLink: '#1f4d45',
            colorText: '#1c1915',
            colorTextSecondary: '#6f675e',
            colorBorder: '#e0d6c8',
            colorBgLayout: '#f3f0ea',
            borderRadius: 12,
            fontFamily: '"Segoe UI", "Avenir Next", "Trebuchet MS", sans-serif',
            controlHeight: 40,
          },
          components: {
            Button: {
              primaryShadow: 'none',
              defaultShadow: 'none',
              dangerShadow: 'none',
            },
          },
        }}
      >
        <AntApp>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </QueryClientProvider>
        </AntApp>
      </XProvider>
    </div>
  </StrictMode>,
)
