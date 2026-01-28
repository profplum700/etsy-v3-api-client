import React from 'react';
import { render, screen } from '@testing-library/react';
import { Layout, Header, Sidebar, SidebarItem } from '../src/components/Layout';

describe('Layout components', () => {
  describe('Layout', () => {
    it('should render children', () => {
      render(
        <Layout>
          <div>Test content</div>
        </Layout>
      );
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should render header', () => {
      render(
        <Layout header={<div>Test header</div>}>
          <div>Content</div>
        </Layout>
      );
      expect(screen.getByText('Test header')).toBeInTheDocument();
    });

    it('should render sidebar', () => {
      render(
        <Layout sidebar={<div>Test sidebar</div>}>
          <div>Content</div>
        </Layout>
      );
      expect(screen.getByText('Test sidebar')).toBeInTheDocument();
    });

    it('should render footer', () => {
      render(
        <Layout footer={<div>Test footer</div>}>
          <div>Content</div>
        </Layout>
      );
      expect(screen.getByText('Test footer')).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('should render title', () => {
      render(<Header title="Test Title" />);
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('should render children', () => {
      render(
        <Header>
          <div>Test children</div>
        </Header>
      );
      expect(screen.getByText('Test children')).toBeInTheDocument();
    });
  });

  describe('Sidebar', () => {
    it('should render children', () => {
      render(
        <Sidebar>
          <div>Sidebar content</div>
        </Sidebar>
      );
      expect(screen.getByText('Sidebar content')).toBeInTheDocument();
    });
  });

  describe('SidebarItem', () => {
    it('should render label', () => {
      render(<SidebarItem label="Test Item" />);
      expect(screen.getByText('Test Item')).toBeInTheDocument();
    });

    it('should render as link when href provided', () => {
      render(<SidebarItem label="Test Link" href="/test" />);
      const link = screen.getByText('Test Link').closest('a');
      expect(link).toHaveAttribute('href', '/test');
    });

    it('should render as button when onClick provided', () => {
      const onClick = vi.fn();
      render(<SidebarItem label="Test Button" onClick={onClick} />);
      const button = screen.getByText('Test Button').closest('button');
      expect(button).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
      const onClick = vi.fn();
      render(<SidebarItem label="Test Button" onClick={onClick} />);
      const button = screen.getByText('Test Button').closest('button');
      button?.click();
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should apply active class', () => {
      render(<SidebarItem label="Active Item" active />);
      const item = screen.getByText('Active Item').closest('button');
      expect(item).toHaveClass('active');
    });
  });
});
