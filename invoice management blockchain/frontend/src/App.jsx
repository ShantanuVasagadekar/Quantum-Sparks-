import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useSseReload } from './api/useSseReload'
import { isLoggedIn, clearToken } from './api/auth'
import CreateInvoicePage from './pages/CreateInvoicePage'
import ClientsPage from './pages/ClientsPage'
import DashboardPage from './pages/DashboardPage'
import InvoicesPage from './pages/InvoicesPage'
import LoginPage from './pages/LoginPage'

const Icons = {
  Home: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
  ),
  Invoices: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  ),
  Clients: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
  ),
  Plus: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
  ),
  Logout: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
  )
}

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
            <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
              
              {/* Sidebar content */}
              <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
                <div className="h-16 flex items-center px-6 border-b border-gray-200">
                  <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center mr-3">
                    <span className="text-white font-bold text-sm">IM</span>
                  </div>
                  <h1 className="text-lg font-bold text-gray-900">Invoice Hub</h1>
                </div>
                
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                  <NavTab to="/" icon={<Icons.Home />}>Dashboard</NavTab>
                  <NavTab to="/invoices" icon={<Icons.Invoices />}>Invoices</NavTab>
                  <NavTab to="/clients" icon={<Icons.Clients />}>Clients</NavTab>
                  
                  <div className="pt-8 pb-2">
                    <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Actions</p>
                  </div>
                  <NavTab to="/invoices/new" icon={<Icons.Plus />}>Create Invoice</NavTab>
                </nav>

                <div className="p-4 border-t border-gray-200">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-red-50 hover:text-red-700 transition-colors"
                  >
                    <Icons.Logout /> Logout
                  </button>
                </div>
              </aside>

              {/* Main content wrapper */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header Topbar */}
                <header className="h-16 flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm">
                  <div className="flex-1 flex items-center">
                    <div className="relative w-96">
                      <input 
                        type="text" 
                        placeholder="Search invoices or clients..." 
                        className="w-full h-9 rounded-md border border-gray-300 pl-10 pr-4 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-900 placeholder-gray-500" 
                        disabled 
                      />
                      <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200">
                      <span className="text-sm font-medium text-indigo-700">A</span>
                    </div>
                  </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-auto">
                  <div className="max-w-7xl mx-auto px-8 py-8">
                    <Routes>
                      <Route path="/" element={<DashboardPage refreshToken={refreshToken} />} />
                      <Route path="/invoices" element={<InvoicesPage refreshToken={refreshToken} />} />
                      <Route path="/clients" element={<ClientsPage refreshToken={refreshToken} />} />
                      <Route path="/invoices/new" element={<CreateInvoicePage />} />
                    </Routes>
                  </div>
                </main>
              </div>

            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function NavTab({ to, icon, children }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
          isActive
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      {icon}
      {children}
    </NavLink>
  )
}

export default App
