import React from 'react';
import { AdminRoute } from '../../components/admin/AdminRoute';
import { AdminDashboard } from '../../components/admin/AdminDashboard';

/**
 * Admin page component with route protection
 */
const Admin: React.FC = () => {
  return (
    <AdminRoute>
      <AdminDashboard />
    </AdminRoute>
  );
};

export default Admin;