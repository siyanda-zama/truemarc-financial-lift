import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
// Global CSS first so page/component stylesheets (imported by App's tree) win at equal specificity.
import './index.css'
import './styles/brand.css'
import App from './App'

const container = document.getElementById('root')!
const app = (
  <HelmetProvider>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </HelmetProvider>
)

// Prerendered pages carry data-prerendered="<route>". Hydrate only when that markup belongs to the URL
// being viewed; a shared shell (404.html served for an unknown URL) is re-rendered from scratch instead.
const strip = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p)
const pre = container.dataset.prerendered
if (pre && container.firstElementChild && strip(pre) === strip(window.location.pathname)) {
  // SplitText reads this flag to render headlines visible (no entrance) during hydration; App clears it after mount.
  document.documentElement.dataset.hydrating = '1'
  hydrateRoot(container, app)
} else {
  createRoot(container).render(app)
}
