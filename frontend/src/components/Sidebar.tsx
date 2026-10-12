import {
  LayoutDashboard,
  MessageSquare,
  Link,
  BarChart3,
  History,
  Settings,
  ShieldCheck
} from "lucide-react";

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

export default function Sidebar({
  activePage,
  setActivePage
}: SidebarProps) {

  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Message Scanner", icon: MessageSquare },
    { name: "URL Scanner", icon: Link },
    { name: "Analytics", icon: BarChart3 },
    { name: "Scan History", icon: History },
    { name: "Settings", icon: Settings }
  ];

  return (
    <aside className="sidebar">

      <div className="sidebar-logo">
        <ShieldCheck size={30} color="#38bdf8" />
        <h2>ScamShield<span>AI</span></h2>
      </div>

      <div className="sidebar-section-title">
        WORKSPACE
      </div>

      <nav className="sidebar-menu">

        {menuItems.map((item) => {

          const Icon = item.icon;

          return (
            <button
              key={item.name}
              className={
                activePage === item.name
                  ? "sidebar-item active"
                  : "sidebar-item"
              }
              onClick={() => setActivePage(item.name)}
            >
              <Icon size={19} />
              <span>{item.name}</span>
            </button>
          );

        })}

      </nav>

      <div className="sidebar-bottom">
        <ShieldCheck size={18} />
        <span>Security Workspace</span>
      </div>

    </aside>
  );
}