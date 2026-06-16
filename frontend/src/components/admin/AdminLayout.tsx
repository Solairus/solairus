import React, { ReactNode, useState } from 'react';
import { AdminNavigation } from './AdminNavigation';
import { AdminMobileNavigation } from './AdminMobileNavigation';
import { AdminHeader } from './AdminHeader';
import { AdminBreadcrumbs } from './Breadcrumbs';

interface AdminLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

/**
 * Responsive layout component for admin interface
 * - Desktop: Sidebar navigation
 * - Mobile: Header + bottom navigation
 */
export const AdminLayout: React.FC<AdminLayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange 
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:flex h-screen bg-gray-900">
        {/* Desktop Sidebar Navigation */}
        <AdminNavigation 
          activeTab={activeTab} 
          onTabChange={onTabChange} 
        />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Desktop Breadcrumbs */}
          <div className="border-b border-gray-700 px-6 py-3 bg-gray-900/50">
            <AdminBreadcrumbs 
              activeTab={activeTab} 
              onTabChange={onTabChange}
            />
          </div>
          
          <div className="flex-1 overflow-auto p-6">
            {children}
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden min-h-screen bg-gray-900 pb-16">
        {/* Mobile Header */}
        <AdminHeader 
          activeTab={activeTab}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMenuOpen={isMobileMenuOpen}
        />
        
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="absolute top-0 left-0 w-80 h-full bg-gray-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <AdminNavigation 
                activeTab={activeTab} 
                onTabChange={(tab) => {
                  onTabChange(tab);
                  setIsMobileMenuOpen(false);
                }}
                isMobile={true}
              />
            </div>
          </div>
        )}
        
        {/* Main Content */}
        <div className="px-4 py-6">
          {/* Mobile Breadcrumbs */}
          <div className="mb-4">
            <AdminBreadcrumbs 
              activeTab={activeTab} 
              onTabChange={onTabChange}
            />
          </div>
          
          {children}
        </div>
        
        {/* Mobile Bottom Navigation */}
        <AdminMobileNavigation 
          activeTab={activeTab} 
          onTabChange={onTabChange} 
        />
      </div>
    </>
  );
};