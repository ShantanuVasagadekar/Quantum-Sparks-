import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useSseReload } from './api/useSseReload'
import { isLoggedIn, clearToken } from './api/auth'
import CreateInvoicePage from './pages/CreateInvoicePage'
import ClientsPage from './pages/ClientsPage'
import DashboardPage from './pages/DashboardPage'
import InvoicesPage from './pages/InvoicesPage'
import LoginPage from './pages/LoginPage'

function ProtectedRoute({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return children
}

function App() {
  const refreshToken = useSseReload()

  function handleLogout() {
    clearToken()
    window.location.href = '/login'
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-slate-950 text-slate-100">
              <header className="border-b border-slate-700 bg-slate-900/95 backdrop-blur">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-white">Invoice Management</h1>
                    <p className="mt-1 text-sm text-slate-400">Cash flow and collections visibility for your business</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <nav className="flex flex-wrap gap-2 rounded-lg border border-slate-700 bg-slate-900 p-1">
                      <NavTab to="/">Dashboard</NavTab>
                      <NavTab to="/invoices">Invoices</NavTab>
                      <NavTab to="/clients">Clients</NavTab>
                      <NavTab to="/invoices/new">Create Invoice</NavTab>
                    </nav>
                    <button
                      onClick={handleLogout}
                      className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </header>

              <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <Routes>
                  <Route path="/" element={<DashboardPage refreshToken={refreshToken} />} />
                  <Route path="/invoices" element={<InvoicesPage refreshToken={refreshToken} />} />
                  <Route path="/clients" element={<ClientsPage refreshToken={refreshToken} />} />
                  <Route path="/invoices/new" element={<CreateInvoicePage />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function NavTab({ to, children }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `rounded-md px-3 py-2 text-sm font-medium ${
          isActive
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export default App
