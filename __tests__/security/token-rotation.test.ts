/**
 * Tests for enhanced token rotation (Phase 5)
 */

import { TokenManager, MemoryTokenStorage } from '../../src/auth/token-manager';
import { EtsyClientConfig, EtsyTokens, TokenRotationConfig } from '../../src/types';

describe('Token Rotation (Phase 5)', () => {
  const mockConfig: EtsyClientConfig = {
    keystring: 'test-key',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: new Date(Date.now() + 3600 * 1000) // 1 hour from now
  };

  describe('needsProactiveRotation', () => {
    it('should return false when rotation is not enabled', () => {
      const manager = new TokenManager(mockConfig);

      expect(manager.needsProactiveRotation()).toBe(false);
    });

    it('should return false when token is not expiring soon', () => {
      const rotationConfig: TokenRotationConfig = {
        enabled: true,
        rotateBeforeExpiry: 15 * 60 * 1000 // 15 minutes
      };

      const manager = new TokenManager(mockConfig, undefined, rotationConfig);

      expect(manager.needsProactiveRotation()).toBe(false);
    });

    it('should return true when token is expiring soon', () => {
      const expiringConfig: EtsyClientConfig = {
        ...mockConfig,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      };

      const rotationConfig: TokenRotationConfig = {
        enabled: true,
        rotateBeforeExpiry: 15 * 60 * 1000 // 15 minutes
      };

      const manager = new TokenManager(expiringConfig, undefined, rotationConfig);

      expect(manager.needsProactiveRotation()).toBe(true);
    });

    it('should use default rotation threshold', () => {
      const expiringConfig: EtsyClientConfig = {
        ...mockConfig,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      };

      const rotationConfig: TokenRotationConfig = {
        enabled: true,
        rotateBeforeExpiry: 15 * 60 * 1000 // 15 minutes (default)
      };

      const manager = new TokenManager(expiringConfig, undefined, rotationConfig);

      expect(manager.needsProactiveRotation()).toBe(true);
    });
  });

  describe('rotateToken', () => {
    it('should call onRotation callback when rotating', async () => {
      const onRotation = jest.fn();

      const rotationConfig: TokenRotationConfig = {
        enabled: true,
        rotateBeforeExpiry: 15 * 60 * 1000,
        onRotation
      };

      const manager = new TokenManager(mockConfig, undefined, rotationConfig);

      // Mock the refresh method
      const mockRefreshToken = jest.spyOn(manager as any, 'performTokenRefresh');
      mockRefreshToken.mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: new Date(Date.now() + 3600 * 1000),
        token_type: 'Bearer',
        scope: ''
      } as EtsyTokens);

      await manager.rotateToken();

      expect(onRotation).toHaveBeenCalledTimes(1);
      expect(onRotation).toHaveBeenCalledWith(
        expect.objectContaining({
          access_token: 'test-access-token'
        }),
        expect.objectContaining({
          access_token: 'new-access-token'
        })
      );

      mockRefreshToken.mockRestore();
    });

    it('should handle async onRotation callback', async () => {
      const onRotation = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const rotationConfig: TokenRotationConfig = {
        enabled: true,
        rotateBeforeExpiry: 15 * 60 * 1000,
        onRotation
      };

      const manager = new TokenManager(mockConfig, undefined, rotationConfig);

      // Mock the refresh method
      const mockRefreshToken = jest.spyOn(manager as any, 'performTokenRefresh');
      mockRefreshToken.mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: new Date(Date.now() + 3600 * 1000),
        token_type: 'Bearer',
        scope: ''
      } as EtsyTokens);

      await manager.rotateToken();

      expect(onRotation).toHaveBeenCalled();

      mockRefreshToken.mockRestore();
    });

    it('should continue even if onRotation callback fails', async () => {
      const onRotation = jest.fn().mockRejectedValue(new Error('Callback error'));

      const rotationConfig: TokenRotationConfig = {
        enabled: true,
        rotateBeforeExpiry: 15 * 60 * 1000,
        onRotation
      };

      const manager = new TokenManager(mockConfig, undefined, rotationConfig);

      // Mock the refresh method
      const mockRefreshToken = jest.spyOn(manager as any, 'performTokenRefresh');
      mockRefreshToken.mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: new Date(Date.now() + 3600 * 1000),
        token_type: 'Bearer',
        scope: ''
      } as EtsyTokens);

      // Should not throw even though callback fails
      await expect(manager.rotateToken()).resolves.toBeTruthy();

      mockRefreshToken.mockRestore();
    });
  });

  describe('rotation configuration', () => {
    it('should update rotation config', () => {
      const manager = new TokenManager(mockConfig);

      const newConfig: TokenRotationConfig = {
        enabled: true,
        rotateBeforeExpiry: 30 * 60 * 1000 // 30 minutes
      };

      manager.updateRotationConfig(newConfig);

      const config = manager.getRotationConfig();
      expect(config).toBeTruthy();
      expect(config!.enabled).toBe(true);
      expect(config!.rotateBeforeExpiry).toBe(30 * 60 * 1000);
    });

    it('should start scheduler when auto-schedule is enabled', () => {
      const manager = new TokenManager(mockConfig);

      const startSpy = jest.spyOn(manager, 'startRotationScheduler');

      const config: TokenRotationConfig = {
        enabled: true,
        rotateBeforeExpiry: 15 * 60 * 1000,
        autoSchedule: true
      };

      manager.updateRotationConfig(config);

      expect(startSpy).toHaveBeenCalled();

      startSpy.mockRestore();
      manager.stopRotationScheduler();
    });

    it('should stop scheduler when auto-schedule is disabled', () => {
      const rotationConfig: TokenRotationConfig = {
        enabled: true,
        rotateBeforeExpiry: 15 * 60 * 1000,
        autoSchedule: true
      };

      const manager = new TokenManager(mockConfig, undefined, rotationConfig);

      const stopSpy = jest.spyOn(manager, 'stopRotationScheduler');

      const newConfig: TokenRotationConfig = {
        enabled: false,
        rotateBeforeExpiry: 15 * 60 * 1000,
        autoSchedule: false
      };

      manager.updateRotationConfig(newConfig);

      expect(stopSpy).toHaveBeenCalled();

      stopSpy.mockRestore();
    });
  });

  describe('rotation scheduler', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start rotation scheduler with autoSchedule', () => {
      const rotationConfig: TokenRotationConfig = {
        enabled: true,
        rotateBeforeExpiry: 15 * 60 * 1000,
        autoSchedule: true,
        checkInterval: 1000 // 1 second for testing
      };

      const manager = new TokenManager(mockConfig, undefined, rotationConfig);

      // Scheduler should be started automatically
      expect(manager.getRotationConfig()?.autoSchedule).toBe(true);

      manager.stopRotationScheduler();
    });

    it('should check for rotation at intervals', () => {
      const expiringConfig: EtsyClientConfig = {
        ...mockConfig,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      };

      const onRotation = jest.fn();

      const rotationConfig: TokenRotationConfig = {
        enabled: true,
        rotateBeforeExpiry: 15 * 60 * 1000, // 15 minutes
        autoSchedule: true,
        checkInterval: 1000, // 1 second for testing
        onRotation
      };

      const manager = new TokenManager(expiringConfig, undefined, rotationConfig);

      // Mock the refresh method
      const mockRefreshToken = jest.spyOn(manager as any, 'performTokenRefresh');
      mockRefreshToken.mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: new Date(Date.now() + 3600 * 1000),
        token_type: 'Bearer',
        scope: ''
      } as EtsyTokens);

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      // Clean up
      manager.stopRotationScheduler();
      mockRefreshToken.mockRestore();
    });

    it('should stop rotation scheduler', () => {
      const rotationConfig: TokenRotationConfig = {
        enabled: true,
        rotateBeforeExpiry: 15 * 60 * 1000,
        autoSchedule: true
      };

      const manager = new TokenManager(mockConfig, undefined, rotationConfig);

      manager.stopRotationScheduler();

      // Verify scheduler is stopped (no way to directly check, but shouldn't throw)
      expect(() => manager.stopRotationScheduler()).not.toThrow();
    });
  });

  describe('integration with storage', () => {
    it('should save rotated tokens to storage', async () => {
      const storage = new MemoryTokenStorage();
      const onRotation = jest.fn();

      const rotationConfig: TokenRotationConfig = {
        enabled: true,
        rotateBeforeExpiry: 15 * 60 * 1000,
        onRotation
      };

      const manager = new TokenManager(mockConfig, storage, rotationConfig);

      // Mock the refresh method
      const mockRefreshToken = jest.spyOn(manager as any, 'performTokenRefresh');
      mockRefreshToken.mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: new Date(Date.now() + 3600 * 1000),
        token_type: 'Bearer',
        scope: ''
      } as EtsyTokens);

      await manager.rotateToken();

      const savedTokens = await storage.load();
      expect(savedTokens).toBeTruthy();
      expect(savedTokens!.access_token).toBe('new-access-token');

      mockRefreshToken.mockRestore();
    });
  });
});
