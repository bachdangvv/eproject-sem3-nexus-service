import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import Hero from './components/landing/Hero'
import TrackingWidget from './components/landing/TrackingWidget'
import TelemetryCard from './components/landing/TelemetryCard'
import ServicesSection from './components/landing/ServicesSection'
import BulkDiscountCalculator from './components/landing/BulkDiscountCalculator'
import PromoSurveyBar from './components/landing/PromoSurveyBar'
import LoginPage from './pages/auth/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import BackgroundAtmosphere from './components/common/BackgroundAtmosphere'
import { REVIEW1_API_MODE } from './services/review1Api'

const NewOrderPage = lazy(() => import('./pages/retail/NewOrderPage'))
const OrdersListPage = lazy(() => import('./pages/retail/OrdersListPage'))
const TechnicalSurveyPage = lazy(() => import('./pages/technical/TechnicalSurveyPage'))
const TechnicalActivationPage = lazy(() => import('./pages/technical/TechnicalActivationPage'))
const AccountLifecyclePage = lazy(() => import('./pages/technical/AccountLifecyclePage'))
const BillingInvoicingPage = lazy(() => import('./pages/accounts/BillingInvoicingPage'))
const CdrMeteringPage = lazy(() => import('./pages/accounts/CdrMeteringPage'))
const DebtManagementPage = lazy(() => import('./pages/accounts/DebtManagementPage'))
const AccountsTariffsPage = lazy(() => import('./pages/accounts/AccountsTariffsPage'))
const TaxAuditReportsPage = lazy(() => import('./pages/accounts/TaxAuditReportsPage'))
const PlansManagementPage = lazy(() => import('./pages/admin/PlansManagementPage'))
const AdminCustomersPage = lazy(() => import('./pages/admin/AdminCustomersPage'))
const AdminBulkSchemesPage = lazy(() => import('./pages/admin/AdminBulkSchemesPage'))
const VendorsShopsPage = lazy(() => import('./pages/admin/VendorsShopsPage'))
const InventoryHardwarePage = lazy(() => import('./pages/admin/InventoryHardwarePage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const CustomerPortalPage = lazy(() => import('./pages/customer/CustomerPortalPage'))
const ComingSoonPage = lazy(() => import('./pages/common/ComingSoonPage'))
const NotFoundPage = lazy(() => import('./pages/common/NotFoundPage'))
const ReviewScopePage = lazy(() => import('./pages/review/ReviewScopePage'))

function RouteSuspenseFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Loading Carrier Module...</span>
      </div>
    </div>
  )
}

function LandingLayout() {
  return (
    <div className="relative min-h-screen">
      <BackgroundAtmosphere />
      <Header />
      <main>
        <Hero />
        <section className="mx-auto mt-6 grid max-w-[1680px] gap-6 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
          <TrackingWidget />
          <TelemetryCard />
        </section>
        <ServicesSection />
        <BulkDiscountCalculator />
        <PromoSurveyBar />
      </main>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteSuspenseFallback />}>
      <Routes>
        <Route path="/" element={<LandingLayout />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/coming-soon" element={<ComingSoonPage />} />

        <Route
          path="/customer"
          element={
            <ProtectedRoute allowedRoles={['customer', 'admin']}>
              <CustomerPortalPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/retail/orders"
          element={
            <ProtectedRoute allowedRoles={REVIEW1_API_MODE ? ['retail'] : ['retail', 'admin']}>
              <OrdersListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/retail/orders/new"
          element={
            <ProtectedRoute allowedRoles={REVIEW1_API_MODE ? ['retail'] : ['retail', 'admin']}>
              <NewOrderPage />
            </ProtectedRoute>
          }
        />
        {REVIEW1_API_MODE && (
          <>
            <Route path="/retail/customers" element={
              <ProtectedRoute allowedRoles={['retail']}><AdminCustomersPage portal="retail" /></ProtectedRoute>
            } />
            <Route path="/retail/quotes" element={
              <ProtectedRoute allowedRoles={['retail']}><ReviewScopePage scope="quotes" /></ProtectedRoute>
            } />
            <Route path="/retail/pos" element={
              <ProtectedRoute allowedRoles={['retail']}><ReviewScopePage scope="pos" /></ProtectedRoute>
            } />
          </>
        )}

        <Route
          path="/technical/surveys"
          element={
            <ProtectedRoute allowedRoles={REVIEW1_API_MODE ? ['technical'] : ['technical', 'admin']}>
              <TechnicalSurveyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/technical/activations"
          element={
            <ProtectedRoute allowedRoles={REVIEW1_API_MODE ? ['technical'] : ['technical', 'admin']}>
              <TechnicalActivationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/technical/lifecycle"
          element={
            <ProtectedRoute allowedRoles={REVIEW1_API_MODE ? ['technical'] : ['technical', 'admin', 'accounts']}>
              {REVIEW1_API_MODE ? <ReviewScopePage scope="lifecycle" /> : <AccountLifecyclePage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/technical/activations/:orderId"
          element={
            <ProtectedRoute allowedRoles={REVIEW1_API_MODE ? ['technical'] : ['technical', 'admin']}>
              <TechnicalActivationPage />
            </ProtectedRoute>
          }
        />
        {REVIEW1_API_MODE && (
          <>
            <Route path="/technical/map" element={
              <ProtectedRoute allowedRoles={['technical']}><ReviewScopePage scope="map" /></ProtectedRoute>
            } />
            <Route path="/technical/diagnostics" element={
              <ProtectedRoute allowedRoles={['technical']}><ReviewScopePage scope="diagnostics" /></ProtectedRoute>
            } />
            <Route path="/accounts/overview" element={
              <ProtectedRoute allowedRoles={['accounts']}><ReviewScopePage scope="overview-accounts" /></ProtectedRoute>
            } />
            <Route path="/admin/overview" element={
              <ProtectedRoute allowedRoles={['admin']}><ReviewScopePage scope="overview-admin" /></ProtectedRoute>
            } />
          </>
        )}

        <Route
          path="/accounts/billing"
          element={
            <ProtectedRoute allowedRoles={REVIEW1_API_MODE ? ['accounts'] : ['accounts', 'admin']}>
              <BillingInvoicingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts/cdr"
          element={
            <ProtectedRoute allowedRoles={REVIEW1_API_MODE ? ['accounts'] : ['accounts', 'admin']}>
              {REVIEW1_API_MODE ? <ReviewScopePage scope="cdr" /> : <CdrMeteringPage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts/debts"
          element={
            <ProtectedRoute allowedRoles={REVIEW1_API_MODE ? ['accounts'] : ['accounts', 'admin']}>
              {REVIEW1_API_MODE ? <ReviewScopePage scope="debts" /> : <DebtManagementPage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts/tax-reports"
          element={
            <ProtectedRoute allowedRoles={REVIEW1_API_MODE ? ['accounts'] : ['accounts', 'admin']}>
              {REVIEW1_API_MODE ? <ReviewScopePage scope="tax-reports" /> : <TaxAuditReportsPage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts/tariffs"
          element={
            <ProtectedRoute allowedRoles={REVIEW1_API_MODE ? ['accounts'] : ['accounts', 'admin']}>
              {REVIEW1_API_MODE ? <ReviewScopePage scope="tariffs" /> : <AccountsTariffsPage />}
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/customers"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminCustomersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/plans"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <PlansManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/vendors"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              {REVIEW1_API_MODE ? <ReviewScopePage scope="shops" /> : <VendorsShopsPage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/shops"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              {REVIEW1_API_MODE ? <ReviewScopePage scope="shops" /> : <VendorsShopsPage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              {REVIEW1_API_MODE ? <ReviewScopePage scope="inventory" /> : <InventoryHardwarePage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/hardware"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              {REVIEW1_API_MODE ? <ReviewScopePage scope="inventory" /> : <InventoryHardwarePage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/schemes"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              {REVIEW1_API_MODE ? <ReviewScopePage scope="schemes" /> : <AdminBulkSchemesPage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/bulk-schemes"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              {REVIEW1_API_MODE ? <ReviewScopePage scope="schemes" /> : <AdminBulkSchemesPage />}
            </ProtectedRoute>
          }
        />

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
