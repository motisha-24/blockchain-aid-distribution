// ================================================================
//  ProtectedRoute.js — Route access control by role
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  const role  = localStorage.getItem('role');
  const token = localStorage.getItem('token');

  // Not logged in
  if (!token || !role) {
    return <Navigate to="/login" replace/>;
  }

  // Wrong role
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/login" replace/>;
  }

  return children;
}