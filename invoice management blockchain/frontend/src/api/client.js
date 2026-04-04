import axios from 'axios'
import { getToken, clearToken } from './auth'

const isProd = import.meta.env.PROD
const apiUrl = import.meta.env.VITE_API_URL || (isProd ? 'https://quantum-sparks.onrender.com/api' : 'http://localhost:5000/api')

const api = axios.create({
  baseURL: apiUrl,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
