import React from 'react';
import { renderHook } from '@testing-library/react';
import { EtsyProvider, useEtsyClient } from '../src/context';

describe('EtsyProvider', () => {
  it('should provide client to children', () => {
    const mockClient: any = { getShop: vi.fn() };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <EtsyProvider client={mockClient}>{children}</EtsyProvider>
    );

    const { result } = renderHook(() => useEtsyClient(), { wrapper });

    expect(result.current).toBe(mockClient);
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => {
      renderHook(() => useEtsyClient());
    }).toThrow('useEtsyContext must be used within an EtsyProvider');

    console.error = originalError;
  });
});
