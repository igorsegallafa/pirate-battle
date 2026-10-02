import { QueryClientProvider } from '@tanstack/react-query'
import { setupWorker } from 'msw/browser'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { queryClient } from './api/queries'
import { App } from './App'
import { handlers } from './mocks/handlers'
import './styles.css'

// The ranking and match history APIs only exist as mocks, so the worker also runs in the published build.
await setupWorker(...handlers)
  .start({
    onUnhandledFrame: 'bypass',
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
  .catch((error) => console.warn('Mock API unavailable', error))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
