import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';

export const Layout = () => {

  return (
    <div className="grid grid-cols-[auto_1fr] h-screen w-screen overflow-hidden bg-gray-50 dark:bg-[#1e1e1e] text-gray-900 dark:text-white transition-colors duration-200">
      {/* Left Column: Sidebar */}
      <aside className="h-full w-[300px] overflow-hidden z-10 border-r border-gray-200 dark:border-[#3a3a3a]">
        <Sidebar />
      </aside>

      {/* Right Column: Page Content */}
      <main className="h-full overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
};
