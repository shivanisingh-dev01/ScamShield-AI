import { Bell, Search, ShieldCheck } from "lucide-react";

interface HeaderProps {
  activePage: string;
}

export default function Header({ activePage }: HeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">SECURITY WORKSPACE / OVERVIEW</p>
        <h2>{activePage}</h2>
      </div>

      <div className="topbar-actions">
        <div className="system-status">
          <span className="live-dot"></span>
          SYSTEM READY
        </div>

        <button className="icon-button" aria-label="Search">
          <Search size={19} />
        </button>

        <button className="icon-button" aria-label="Notifications">
          <Bell size={19} />
        </button>

        <div className="avatar">
          <ShieldCheck size={21} />
        </div>
      </div>
    </header>
  );
}