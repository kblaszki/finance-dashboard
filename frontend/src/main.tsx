import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { CurrencyProvider } from './state/currency'
import { ThemeProvider } from './state/theme'
import { AuthProvider } from './state/auth'
import { PortfolioProvider } from './state/portfolio'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <CurrencyProvider>
            <PortfolioProvider>
              <App />
            </PortfolioProvider>
          </CurrencyProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
