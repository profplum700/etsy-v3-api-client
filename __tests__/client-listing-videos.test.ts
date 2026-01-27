/**
 * Listing Video tests - upload, get, and delete operations
 */

import { setupClientMocks, MockClientContext, create204Response } from './helpers/client-test-setup';

describe('EtsyClient Listing Videos', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('uploadListingVideo', () => {
    it('should upload a listing video', async () => {
      const mockVideo = {
        video_id: 1,
        height: 1080,
        width: 1920,
        thumbnail_url: 'https://example.com/thumb.jpg',
        video_url: 'https://example.com/video.mp4',
        video_state: 'active'
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockVideo)
      });

      const blob = new Blob(['fake video data'], { type: 'video/mp4' });
      const result = await ctx.client.uploadListingVideo('123', '789', blob);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/videos',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result).toEqual(mockVideo);
    });

    it('should upload a video with optional parameters', async () => {
      const mockVideo = {
        video_id: 1,
        height: 1080,
        width: 1920,
        thumbnail_url: 'https://example.com/thumb.jpg',
        video_url: 'https://example.com/video.mp4',
        video_state: 'active'
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockVideo)
      });

      const blob = new Blob(['fake video data'], { type: 'video/mp4' });
      const result = await ctx.client.uploadListingVideo('123', '789', blob, {
        name: 'demo.mp4',
        video_id: 42
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/videos',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result).toEqual(mockVideo);
    });
  });

  describe('getListingVideos', () => {
    it('should get all listing videos', async () => {
      const mockVideos = {
        count: 2,
        results: [
          {
            video_id: 1,
            height: 1080,
            width: 1920,
            thumbnail_url: 'https://example.com/thumb1.jpg',
            video_url: 'https://example.com/video1.mp4',
            video_state: 'active'
          },
          {
            video_id: 2,
            height: 720,
            width: 1280,
            thumbnail_url: 'https://example.com/thumb2.jpg',
            video_url: 'https://example.com/video2.mp4',
            video_state: 'active'
          }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockVideos)
      });

      const result = await ctx.client.getListingVideos('789');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/789/videos',
        expect.any(Object)
      );
      expect(result).toEqual(mockVideos.results);
    });
  });

  describe('getListingVideo', () => {
    it('should get a specific listing video', async () => {
      const mockVideo = {
        video_id: 1,
        height: 1080,
        width: 1920,
        thumbnail_url: 'https://example.com/thumb.jpg',
        video_url: 'https://example.com/video.mp4',
        video_state: 'active'
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockVideo)
      });

      const result = await ctx.client.getListingVideo('789', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/789/videos/1',
        expect.any(Object)
      );
      expect(result).toEqual(mockVideo);
    });
  });

  describe('deleteListingVideo', () => {
    it('should delete a listing video with 204 No Content response', async () => {
      ctx.mockFetch.mockResolvedValue(create204Response());

      const result = await ctx.client.deleteListingVideo('123', '789', '1');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/videos/1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toBeUndefined();
    });
  });
});
