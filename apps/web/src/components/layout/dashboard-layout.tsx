import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  Users,
  Radio,
  Settings,
  LogOut,
  LayoutDashboard,
  Webhook,
  Send,
  UserCog,
  FileText,
  BarChart3,
  Clock,
  Menu,
  X,
  ChevronRight,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { connectSocket, disconnectSocket } from '@/services/socket';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { GlobalSearch } from '@/components/ui/GlobalSearch';
import { ThemeToggleDropdown } from '@/components/ui/ThemeToggle';
import { useSocketNotifications } from '@/hooks/use-notifications';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/conversations', icon: MessageSquare, label: 'Conversations' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/broadcasts', icon: Send, label: 'Broadcasts' },
  { to: '/scheduled', icon: Clock, label: 'Scheduled' },
  { to: '/templates', icon: FileText, label: 'Templates' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/sessions', icon: Radio, label: 'Sessions' },
  { to: '/integrations', icon: Webhook, label: 'Integrations' },
  { to: '/users', icon: UserCog, label: 'Users', adminOnly: true },
  { to: '/audit-logs', icon: History, label: 'Activity Log', adminOnly: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useSocketNotifications();

  useEffect(() => {
    connectSocket();
    return () => {
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const currentPageTitle = navItems.find(
    (item) => item.to === location.pathname || (item.to !== '/' && location.pathname.startsWith(item.to))
  )?.label || 'Dashboard';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-card/95 backdrop-blur-xl border-r border-border/50',
          'transform transition-all duration-300 ease-premium',
          'lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-72',
          'w-72'
        )}
      >
        {/* Logo Header */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-border/50">
          <div className={cn(
            'flex items-center gap-3 transition-all duration-300',
            sidebarCollapsed && 'lg:justify-center'
          )}>
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <span className={cn(
              'font-semibold text-foreground tracking-tight transition-all duration-300',
              sidebarCollapsed && 'lg:hidden'
            )}>
              WhatsApp CRM
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-accent rounded-xl transition-colors text-muted-foreground"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Profile */}
        <div className={cn(
          'px-4 py-4 border-b border-border/50',
          sidebarCollapsed && 'lg:px-3 lg:py-3'
        )}>
          <div className={cn(
            'flex items-center gap-3',
            sidebarCollapsed && 'lg:justify-center'
          )}>
            <div className="relative flex-shrink-0">
              <div className="h-10 w-10 rounded-xl bg-slate-600 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-card" />
            </div>
            <div className={cn(
              'flex-1 min-w-0 transition-all duration-300',
              sidebarCollapsed && 'lg:hidden'
            )}>
              <p className="text-sm font-medium truncate text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{user?.role}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
          {navItems
            .filter((item) => !item.adminOnly || user?.role === 'admin')
            .map((item, index) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                  'transition-all duration-200 ease-out',
                  'animate-fade-up',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  sidebarCollapsed && 'lg:justify-center lg:px-3'
                )
              }
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <item.icon className={cn(
                'h-5 w-5 flex-shrink-0 transition-transform duration-200',
                'group-hover:scale-110'
              )} />
              <span className={cn(
                'truncate transition-all duration-300',
                sidebarCollapsed && 'lg:hidden'
              )}>
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* Collapse Toggle (Desktop only) */}
        <div className="hidden lg:block px-3 py-2 border-t border-border/50">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm',
              'text-muted-foreground hover:bg-accent hover:text-foreground',
              'transition-all duration-200',
              sidebarCollapsed && 'justify-center'
            )}
          >
            <ChevronRight className={cn(
              'h-5 w-5 transition-transform duration-300',
              !sidebarCollapsed && 'rotate-180'
            )} />
            <span className={cn(
              'transition-all duration-300',
              sidebarCollapsed && 'hidden'
            )}>
              Collapse
            </span>
          </button>
        </div>

        {/* Logout */}
        <div className="p-3 border-t border-border/50">
          <button
            onClick={handleLogout}
            className={cn(
              'group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium',
              'text-red-500 dark:text-red-400 hover:bg-red-500/10',
              'transition-all duration-200',
              sidebarCollapsed && 'lg:justify-center'
            )}
          >
            <LogOut className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span className={cn(
              'transition-all duration-300',
              sidebarCollapsed && 'lg:hidden'
            )}>
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border/50 bg-card/80 backdrop-blur-xl flex items-center justify-between px-4 lg:px-6 flex-shrink-0 relative z-[55]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2.5 hover:bg-accent rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">
                {currentPageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <GlobalSearch />
            <ThemeToggleDropdown />
            <NotificationBell />
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
