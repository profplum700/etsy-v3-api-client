import React, { ReactNode } from 'react';

export interface LayoutProps {
  children: ReactNode;
  className?: string;
  sidebar?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
}

export function Layout({ children, className = '', sidebar, header, footer }: LayoutProps): React.JSX.Element {
  return (
    <div className={`etsy-admin-layout ${className}`}>
      {header && <header className="etsy-admin-header">{header}</header>}

      <div className="etsy-admin-main">
        {sidebar && <aside className="etsy-admin-sidebar">{sidebar}</aside>}
        <main className="etsy-admin-content">{children}</main>
      </div>

      {footer && <footer className="etsy-admin-footer">{footer}</footer>}
    </div>
  );
}

export interface SidebarProps {
  children: ReactNode;
  className?: string;
}

export function Sidebar({ children, className = '' }: SidebarProps): React.JSX.Element {
  return <div className={`etsy-sidebar ${className}`}>{children}</div>;
}

export interface SidebarItemProps {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
}

export function SidebarItem({
  label,
  icon,
  active = false,
  onClick,
  href,
  className = '',
}: SidebarItemProps): React.JSX.Element {
  const classes = `etsy-sidebar-item ${active ? 'active' : ''} ${className}`;

  if (href) {
    return (
      <a href={href} className={classes} onClick={onClick}>
        {icon && <span className="etsy-sidebar-icon">{icon}</span>}
        <span className="etsy-sidebar-label">{label}</span>
      </a>
    );
  }

  return (
    <button className={classes} onClick={onClick}>
      {icon && <span className="etsy-sidebar-icon">{icon}</span>}
      <span className="etsy-sidebar-label">{label}</span>
    </button>
  );
}

export interface HeaderProps {
  title?: string;
  children?: ReactNode;
  className?: string;
}

export function Header({ title, children, className = '' }: HeaderProps): React.JSX.Element {
  return (
    <div className={`etsy-header ${className}`}>
      {title && <h1 className="etsy-header-title">{title}</h1>}
      {children}
    </div>
  );
}
