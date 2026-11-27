import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import Home from '@/pages/Home'
import ServicesHub from '@/pages/services/ServicesHub'
import ServicePage from '@/pages/services/ServicePage'
import HowItWorks from '@/pages/HowItWorks'
import About from '@/pages/About'
import Contact from '@/pages/Contact'
import FreeAssessment from '@/pages/FreeAssessment'
import LearnHub from '@/pages/learn/LearnHub'
import Article from '@/pages/learn/Article'
import Privacy from '@/pages/Privacy'
import Terms from '@/pages/Terms'
import NotFound from '@/pages/NotFound'

export default function App() {
  // Runs after every child's mount effects: hydration of the prerendered page is complete.
  useEffect(() => { delete document.documentElement.dataset.hydrating }, [])
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<ServicesHub />} />
        <Route path="/services/:slug" element={<ServicePage />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/about" element={<About />} />
        <Route path="/why-choose-us" element={<Navigate to="/about" replace />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/free-assessment" element={<FreeAssessment />} />
        <Route path="/learn" element={<LearnHub />} />
        <Route path="/learn/:slug" element={<Article />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
