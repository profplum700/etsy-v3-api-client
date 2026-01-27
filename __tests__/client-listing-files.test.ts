/**
 * Listing File tests - upload, get, and delete operations
 */

import { setupClientMocks, MockClientContext, create204Response } from './helpers/client-test-setup';

describe('EtsyClient Listing Files', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('uploadListingFile', () => {
    it('should upload a listing file', async () => {
      const mockFile = {
        listing_file_id: 555,
        listing_id: 789,
        rank: 1,
        filename: 'pattern.pdf',
        filesize: '1.2MB',
        size_bytes: 1258291,
        filetype: 'application/pdf',
        create_timestamp: 1700000000,
        created_timestamp: 1700000000
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockFile)
      });

      const blob = new Blob(['fake file data'], { type: 'application/pdf' });
      const result = await ctx.client.uploadListingFile('123', '789', blob);

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/files',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result).toEqual(mockFile);
    });

    it('should upload a file with optional parameters', async () => {
      const mockFile = {
        listing_file_id: 555,
        listing_id: 789,
        rank: 2,
        filename: 'instructions.pdf',
        filesize: '500KB',
        size_bytes: 512000,
        filetype: 'application/pdf',
        create_timestamp: 1700000000,
        created_timestamp: 1700000000
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockFile)
      });

      const blob = new Blob(['fake file data'], { type: 'application/pdf' });
      const result = await ctx.client.uploadListingFile('123', '789', blob, {
        name: 'instructions.pdf',
        rank: 2
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/files',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result).toEqual(mockFile);
    });
  });

  describe('getAllListingFiles', () => {
    it('should get all listing files', async () => {
      const mockFiles = {
        count: 2,
        results: [
          {
            listing_file_id: 555,
            listing_id: 789,
            rank: 1,
            filename: 'pattern.pdf',
            filesize: '1.2MB',
            size_bytes: 1258291,
            filetype: 'application/pdf',
            create_timestamp: 1700000000,
            created_timestamp: 1700000000
          },
          {
            listing_file_id: 556,
            listing_id: 789,
            rank: 2,
            filename: 'instructions.pdf',
            filesize: '500KB',
            size_bytes: 512000,
            filetype: 'application/pdf',
            create_timestamp: 1700000000,
            created_timestamp: 1700000000
          }
        ]
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockFiles)
      });

      const result = await ctx.client.getAllListingFiles('123', '789');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/files',
        expect.any(Object)
      );
      expect(result).toEqual(mockFiles.results);
    });
  });

  describe('getListingFile', () => {
    it('should get a specific listing file', async () => {
      const mockFile = {
        listing_file_id: 555,
        listing_id: 789,
        rank: 1,
        filename: 'pattern.pdf',
        filesize: '1.2MB',
        size_bytes: 1258291,
        filetype: 'application/pdf',
        create_timestamp: 1700000000,
        created_timestamp: 1700000000
      };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockFile)
      });

      const result = await ctx.client.getListingFile('123', '789', '555');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/files/555',
        expect.any(Object)
      );
      expect(result).toEqual(mockFile);
    });
  });

  describe('deleteListingFile', () => {
    it('should delete a listing file with 204 No Content response', async () => {
      ctx.mockFetch.mockResolvedValue(create204Response());

      const result = await ctx.client.deleteListingFile('123', '789', '555');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/123/listings/789/files/555',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toBeUndefined();
    });
  });
});
