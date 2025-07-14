# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.1] - 2024-01-13

### Added
- Initial beta release of the Etsy API v3 client
- OAuth 2.0 authentication with PKCE flow support
- Complete TypeScript definitions for all API responses
- Rate limiting with respect to Etsy's API limits (10,000/day, 10/second)
- Automatic token refresh with configurable storage
- Response caching for GET requests
- Support for all major Etsy API v3 endpoints:
  - User management (`getUser`)
  - Shop management (`getShop`, `getShopByOwnerUserId`) 
  - Listing operations (`getListing`, `getListingsByShop`, `findAllListingsActive`)
- Multiple token storage options:
  - `MemoryTokenStorage` for temporary storage
  - `FileTokenStorage` for persistent file-based storage
  - Custom storage interface support
- Comprehensive error handling with specific error types:
  - `EtsyApiError` for API-related errors
  - `EtsyAuthError` for authentication errors
  - `EtsyRateLimitError` for rate limiting violations
- Universal compatibility (Node.js 18+ and modern browsers)
- Built-in fetch fallback for older Node.js versions
- Configurable base URLs for testing and custom endpoints
- Extensive test coverage with Jest
- Full ES modules support with CommonJS compatibility

### Features
- **AuthHelper**: Complete OAuth 2.0 flow implementation with PKCE
- **EtsyClient**: Main API client with automatic token management
- **TokenManager**: Handles token refresh and storage persistence
- **EtsyRateLimiter**: Built-in rate limiting to prevent API violations
- **Caching**: Optional response caching with TTL support
- **TypeScript**: Full type safety with comprehensive interface definitions

### Configuration Options
- Rate limiting can be customized or disabled
- Caching can be enabled/disabled with custom TTL
- Token refresh callbacks for custom storage handling
- Custom logger interface support
- Flexible scope management with predefined combinations

### Scope Support
- Read scopes: `shops_r`, `listings_r`, `profile_r`, `favorites_r`, etc.
- Write scopes: `shops_w`, `listings_w`, `profile_w`, etc.
- Delete scopes: `shops_d`, `listings_d`, etc.
- Transaction and billing scopes: `transactions_r`, `billing_r`
- Predefined scope combinations for common use cases

### API Coverage
- User operations: Get current user information
- Shop operations: Get shop details, search shops by user
- Listing operations: Get individual listings, shop listings, search active listings
- Support for pagination, filtering, and sorting
- Include parameters for related data fetching

### Developer Experience
- Comprehensive documentation and examples
- IDE-friendly with full IntelliSense support
- Clear error messages with actionable information
- Consistent API design patterns
- Zero-configuration setup with sensible defaults

### Technical Details
- Built with Rollup for optimal bundling
- ES modules with CommonJS compatibility
- Tree-shakeable exports
- No runtime dependencies except node-fetch (for older Node.js)
- Supports both named and default imports
- Works in server-side and client-side environments

## [Unreleased]

### Planned
- Additional API endpoint coverage
- Webhook support
- Advanced pagination helpers
- Request retry logic with exponential backoff
- Enhanced caching strategies
- More storage adapter options
- Performance optimizations
- Additional examples and tutorials

---

## Notes

This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

For upgrade instructions and breaking changes, see the [Migration Guide](./MIGRATION.md) (when available).

## Version Schema

- `MAJOR.MINOR.PATCH` for stable releases
- `MAJOR.MINOR.PATCH-beta.N` for beta releases
- `MAJOR.MINOR.PATCH-alpha.N` for alpha releases

## Support

- For bug reports and feature requests, please use [GitHub Issues](https://github.com/profplum700/etsy-v3-api-client/issues)
- For questions and discussions, see [GitHub Discussions](https://github.com/profplum700/etsy-v3-api-client/discussions)