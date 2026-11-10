/**
 * EtsyClient must not let an ID change which endpoint a request reaches
 * (#117). IDs used to go into paths unencoded, and the URL parser resolves
 * "..", so deleteListingImage('1', '2', '../../../../../listings/123') sent
 * DELETE /listings/123.
 */

import { readFileSync } from 'node:fs';
import { EtsyClient } from '../src/client';
import { path } from '../src/utils/path';
import type { EtsyClientConfig } from '../src/types';

describe('path()', () => {
  it('percent-encodes values that fill a path segment', () => {
    expect(path`/shops/${'1/2'}/listings/${'a?b#c'}`).toBe('/shops/1%2F2/listings/a%3Fb%23c');
  });

  it('keeps numbers and plain IDs as they are', () => {
    expect(path`/shops/${123}/listings/${'456'}`).toBe('/shops/123/listings/456');
  });

  it('leaves query strings and query suffixes alone', () => {
    const query = '?includes=Images&legacy=true';
    expect(path`/listings/${'5'}${query}`).toBe('/listings/5?includes=Images&legacy=true');
    expect(path`/shops?${'shop_name=a&limit=2'}`).toBe('/shops?shop_name=a&limit=2');
    expect(path`/shops/${'1'}/listings/featured${''}`).toBe('/shops/1/listings/featured');
  });

  it('turns a traversal attempt into a single, harmless segment', () => {
    const built = path`/shops/${'1'}/listings/${'2'}/images/${'../../../../../listings/123'}`;
    expect(built).toBe('/shops/1/listings/2/images/..%2F..%2F..%2F..%2F..%2Flistings%2F123');
    expect(new URL(`https://api.etsy.com/v3/application${built}`).pathname).toBe(
      '/v3/application/shops/1/listings/2/images/..%2F..%2F..%2F..%2F..%2Flistings%2F123'
    );
  });

  it.each([['.'], ['..'], [''], [null], [undefined]])('refuses %j as a path segment', (value) => {
    expect(() => path`/listings/${value}`).toThrow(TypeError);
  });
});

describe('EtsyClient request paths', () => {
  const requested: string[] = [];

  function client(): EtsyClient {
    const config: EtsyClientConfig = {
      keystring: 'key',
      sharedSecret: 'secret',
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: new Date(Date.now() + 3600000),
      caching: { enabled: false },
      rateLimiting: { enabled: false },
    };
    return new EtsyClient(config);
  }

  beforeEach(() => {
    requested.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        requested.push(new URL(url).pathname + new URL(url).search);
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const TRAVERSAL = '../../../../../listings/123';

  it.each([
    ['deleteListingImage', (c: EtsyClient) => c.deleteListingImage('1', '2', TRAVERSAL)],
    ['deleteListing', (c: EtsyClient) => c.deleteListing(TRAVERSAL)],
    ['getListing', (c: EtsyClient) => c.getListing(TRAVERSAL)],
    ['getShop', (c: EtsyClient) => c.getShop(TRAVERSAL)],
    ['getShopReceipt', (c: EtsyClient) => c.getShopReceipt('1', TRAVERSAL)],
    ['updateListing', (c: EtsyClient) => c.updateListing('1', TRAVERSAL, { title: 'x' })],
    ['getListingTranslation', (c: EtsyClient) => c.getListingTranslation('1', '2', TRAVERSAL)],
    ['uploadListingImage', (c: EtsyClient) => c.uploadListingImage('1', TRAVERSAL, new Blob(['x']))],
    ['uploadListingFile', (c: EtsyClient) => c.uploadListingFile('1', TRAVERSAL, new Blob(['x']), { name: 'f.pdf' })],
    ['uploadListingVideo', (c: EtsyClient) => c.uploadListingVideo('1', TRAVERSAL, new Blob(['x']), { name: 'v.mp4' })],
    [
      'updateListingProperty',
      (c: EtsyClient) =>
        c.updateListingProperty({ shopId: '1', listingId: TRAVERSAL, propertyId: 3, valueIds: [1], values: ['a'] }),
    ],
  ])('%s keeps a traversal ID inside its own path', async (_name, callIt) => {
    await callIt(client()).catch(() => undefined);

    expect(requested).toHaveLength(1);
    expect(requested[0]).not.toMatch(/^\/v3\/application\/listings\/123/);
    expect(requested[0]).toContain('..%2F..%2F');
  });

  it('builds the same URLs as before for numeric IDs', async () => {
    const c = client();
    await c.deleteListingImage('1', '2', '3');
    await c.getListing('5', { includes: ['Images'] });
    await c.getShopReceipt('7', '8');

    expect(requested).toEqual([
      '/v3/application/shops/1/listings/2/images/3',
      '/v3/application/listings/5?includes=Images',
      '/v3/application/shops/7/receipts/8',
    ]);
  });

  it('refuses a "." or ".." ID before sending anything', async () => {
    const c = client();

    await expect(c.deleteListingImage('1', '2', '..')).rejects.toThrow(TypeError);
    await expect(c.getListing('.')).rejects.toThrow(TypeError);
    expect(requested).toHaveLength(0);
  });
});

describe('src/client.ts', () => {
  it('builds every request path with path``', () => {
    const source = readFileSync(new URL('../src/client.ts', import.meta.url), 'utf8');
    // A template literal that starts with "/" and is not tagged with path...
    const untagged = source.match(/(?<![\w$`])`\/[^`]*\$\{/g) ?? [];
    expect(untagged).toEqual([]);
    // ...or one that puts a raw path after the base URL instead of path``.
    const rawAfterBase = source.match(/`\$\{this\.baseUrl\}\/[^`]*`/g) ?? [];
    expect(rawAfterBase).toEqual([]);
  });
});
