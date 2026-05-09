import { EtsyClient } from '../../dist/worker.esm.js';

export default {
  async fetch() {
    const originalFetch = globalThis.fetch;
    let observedUpload = false;

    globalThis.fetch = async (url, init) => {
      observedUpload = true;
      const body = init?.body;
      const image = body?.get?.('image');

      return Response.json({
        url: String(url),
        method: init?.method,
        formData: body instanceof FormData,
        imageIsBlob: image instanceof Blob,
        imageName: typeof image?.name === 'string' ? image.name : null,
        imageSize: image?.size,
        imageText: typeof image?.text === 'function' ? await image.text() : null,
        rank: body?.get?.('rank'),
        contentTypeHeaderSet: Boolean(init?.headers?.['Content-Type'] ?? init?.headers?.['content-type']),
        process: typeof process,
        buffer: typeof Buffer
      });
    };

    try {
      const client = new EtsyClient({
        keystring: 'test-key',
        sharedSecret: 'test-secret',
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 3_600_000),
        rateLimiting: { enabled: false },
        caching: { enabled: false },
        baseUrl: 'https://example.invalid/v3/application'
      });

      const result = await client.uploadListingImage(
        '123',
        '789',
        new Blob(['worker image'], { type: 'image/jpeg' }),
        { rank: 2 }
      );

      return Response.json({ observedUpload, result });
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
};
