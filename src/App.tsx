// App root – declares client-side routes for the entire application
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PatientSearch from './pages/PatientSearch'
import StaffLogin from './pages/StaffLogin'
import StaffDashboard from './pages/StaffDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PatientSearch />} />
        <Route path="/staff" element={<StaffLogin />} />
        <Route path="/staff/dashboard" element={<StaffDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
