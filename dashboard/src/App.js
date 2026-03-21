// ================================================================
//  App.js — Main Application Router with Auth Protection
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar            from './components/Navbar';
import ProtectedRoute    from './components/ProtectedRoute';
import LoginPage         from './pages/LoginPage';
import AdminDashboard    from './pages/AdminDashboard';
import NGODashboard      from './pages/NGODashboard';
import DonorDashboard    from './pages/DonorDashboard';
import AuditorDashboard  from './pages/AuditorDashboard';

// ── Layout wrapper — adds Navbar above every protected page ───
function Layout({ children }) {
  return (
    <>
      <Navbar/>
      {children}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public routes ──────────────────────────────── */}
        <Route path="/login" element={<LoginPage/>}/>

        {/* Default — redirect root to login */}
        <Route path="/" element={<Navigate to="/login" replace/>}/>

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

        {/* ── Catch all — redirect unknown URLs to login ─── */}
        <Route path="*" element={<Navigate to="/login" replace/>}/>

      </Routes>
    </BrowserRouter>
  );
}