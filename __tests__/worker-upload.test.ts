import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerUploadFixturePath = path.join(__dirname, 'fixtures/worker-upload-smoke.mjs');

describe('Worker upload path', () => {
  it('builds a Blob-backed multipart body in Miniflare without Node binary globals', async () => {
    const mf = new Miniflare({
      modules: true,
      scriptPath: workerUploadFixturePath,
      modulesRules: [
        { type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }
      ]
    });

    try {
      const response = await mf.dispatchFetch('https://worker.test/upload-smoke');
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        observedUpload: true,
        result: {
          url: 'https://example.invalid/v3/application/shops/123/listings/789/images',
          method: 'POST',
          formData: true,
          imageIsBlob: true,
          imageName: 'image.jpg',
          imageSize: 12,
          imageText: 'worker image',
          rank: '2',
          contentTypeHeaderSet: false,
          process: 'undefined',
          buffer: 'undefined'
        }
      });
    } finally {
      await mf.dispose();
    }
  });
});
