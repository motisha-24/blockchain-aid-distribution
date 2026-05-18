// ================================================================
//  App.js — Main Application Router with Auth Protection
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar            from './components/Navbar';
import Footer            from './components/Footer';
import ProtectedRoute    from './components/ProtectedRoute';
import LoginPage         from './pages/LoginPage';
import ForgotCredentialsPage from './pages/ForgotCredentialsPage';
import AdminDashboard    from './pages/AdminDashboard';
import NGODashboard      from './pages/NGODashboard';
import DonorDashboard    from './pages/DonorDashboard';
import AuditorDashboard  from './pages/AuditorDashboard';
import PrivacyPage      from './pages/PrivacyPage';
import TermsPage        from './pages/TermsPage';
import SecurityAuditPage from './pages/SecurityAuditPage';

// ── Layout wrapper — adds Navbar above every protected page ───
function Layout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar/>
      <div style={{ flex: 1 }}>{children}</div>
      <Footer/>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public routes ──────────────────────────────── */}
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="/recover" element={<ForgotCredentialsPage/>}/>

        {/* Default — redirect root to login */}
        <Route path="/" element={<Navigate to="/login" replace/>}/>

        {/* ── Info pages ────────────────────────────────── */}
        <Route path="/privacy" element={<Layout><PrivacyPage/></Layout>}/>
        <Route path="/terms" element={<Layout><TermsPage/></Layout>}/>

        {/* ── Admin only ─────────────────────────────────── */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Layout><AdminDashboard/></Layout>
          </ProtectedRoute>
        }/>

        {/* ── NGO — NGO staff and Admin ──────────────────── */}
        <Route path="/ngo" element={
          <ProtectedRoute allowedRoles={['NGO', 'ADMIN']}>
            <Layout><NGODashboard/></Layout>
          </ProtectedRoute>
        }/>

        {/* ── Donor — Donors and Admin ───────────────────── */}
        <Route path="/donor" element={
          <ProtectedRoute allowedRoles={['DONOR', 'ADMIN']}>
            <Layout><DonorDashboard/></Layout>
          </ProtectedRoute>
        }/>

        {/* ── Auditor — Auditors and Admin ───────────────── */}
        <Route path="/auditor" element={
          <ProtectedRoute allowedRoles={['AUDITOR', 'ADMIN']}>
            <Layout><AuditorDashboard/></Layout>
          </ProtectedRoute>
        }/>

        {/* ── Security Operations & Threat Intel — Admin & Auditor ── */}
        <Route path="/security" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'AUDITOR']}>
            <Layout><SecurityAuditPage/></Layout>
          </ProtectedRoute>
        }/>

        {/* ── Catch all — redirect unknown URLs to login ─── */}
        <Route path="*" element={<Navigate to="/login" replace/>}/>

      </Routes>
    </BrowserRouter>
  );
}
