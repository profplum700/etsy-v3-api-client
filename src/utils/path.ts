/**
 * Build an Etsy API request path from a template, encoding each value that
 * fills a path segment.
 *
 * `EtsyClient` used to drop IDs into paths as they were. The URL parser
 * resolves `..`, so an ID such as `../../listings/123` reached a different
 * endpoint: `deleteListingImage('1', '2', '../../../../../listings/123')`
 * sent `DELETE /listings/123` (#117).
 *
 * A value that directly follows a `/` in the template is a path segment. It
 * is percent-encoded, so `/`, `?` and `#` can't change the path, the query or
 * the fragment. Values that can't be a segment are refused with a `TypeError`:
 * `.` and `..`, which URL parsers collapse even when percent-encoded, an empty
 * string, `null` and `undefined`. Any other value, such as a query string
 * after `?` or a `${query}` suffix, is inserted as it is: callers build those
 * with `URLSearchParams`.
 *
 * @example
 * path`/shops/${shopId}/listings/${listingId}${query}`
 */
export function path(strings: TemplateStringsArray, ...values: unknown[]): string {
  let result = strings[0] ?? '';
  values.forEach((value, index) => {
    const isSegment = result.endsWith('/');
    result += (isSegment ? encodeSegment(value) : String(value)) + (strings[index + 1] ?? '');
  });
  return result;
}

/** Percent-encode one path segment, refusing values that can't be one. */
function encodeSegment(value: unknown): string {
  if (value === null || value === undefined) {
    throw new TypeError(`Invalid path parameter: ${String(value)}`);
  }
  const text = String(value);
  if (text === '' || text === '.' || text === '..') {
    throw new TypeError(`Invalid path parameter: ${JSON.stringify(text)}`);
  }
  return encodeURIComponent(text);
}
