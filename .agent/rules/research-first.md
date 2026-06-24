# CRITICAL: Research-First Development Approach

**MANDATORY REQUIREMENT**: Before starting any implementation or planning, you MUST conduct thorough research using available tools.

## Research Protocol (MUST FOLLOW)

### 1. Pre-Implementation Research (REQUIRED)

Before writing any code or creating a plan, you MUST:

1. **Use Context7 MCP** to fetch the latest documentation for all relevant libraries and frameworks
   - Example: If implementing a Next.js feature, fetch Next.js documentation first
   - Example: If using a new npm package, research its latest API and best practices
   - Example: If implementing Supabase features, verify current API specifications

2. **Use WebSearch** to verify current best practices and common pitfalls
   - Search for: "[Technology] [Feature] best practices 2025"
   - Search for: "[Library] [Version] breaking changes"
   - Search for: "[Framework] official documentation [specific feature]"

3. **Use WebFetch** to read official documentation directly
   - Fetch official docs, not blog posts or outdated tutorials
   - Verify API syntax, parameter names, and return types
   - Check for deprecation warnings and recommended alternatives

### 2. What to Research

**ALWAYS research**:
- Library/framework versions and their current APIs
- Deprecated features and their replacements
- Breaking changes in recent versions
- Official recommended patterns and anti-patterns
- TypeScript type definitions and interfaces
- Configuration file formats and schemas
- CLI command syntax and options

**NEVER**:
- Make assumptions based on memory or general knowledge
- Use outdated patterns without verification
- Implement features without checking official docs
- Guess API signatures or parameter types

### 3. Research Checklist

Before implementation, confirm you have:
- [ ] Checked Context7 for latest library documentation
- [ ] Verified API syntax with official sources
- [ ] Searched for breaking changes and migration guides
- [ ] Reviewed official examples and best practices
- [ ] Confirmed TypeScript types and interfaces
- [ ] Validated configuration formats

### 4. When Research is Required

**MANDATORY research scenarios**:
- Using any external library or framework
- Implementing authentication or security features
- Configuring build tools or bundlers
- Setting up database schemas or migrations
- Integrating third-party APIs or services
- Using CLI tools with specific syntax
- Implementing real-time features
- Working with type definitions

**Example: Before implementing Supabase Realtime**
```bash
# MUST DO:
1. Use Context7: Get latest @supabase/supabase-js documentation
2. Use WebFetch: Read https://supabase.com/docs/guides/realtime/postgres-changes
3. Use WebSearch: Search "Supabase realtime ALTER PUBLICATION 2025"
4. Verify: ALTER PUBLICATION syntax from PostgreSQL docs
5. Confirm: RLS integration and client API
# ONLY THEN: Write implementation code
```

### 5. Consequences of Skipping Research

**DO NOT**:
- ❌ Implement features based on outdated knowledge
- ❌ Use deprecated APIs without checking alternatives
- ❌ Write code with incorrect syntax or parameters
- ❌ Create configurations that don't match current schemas
- ❌ Make assumptions about library behavior

**ALWAYS**:
- ✅ Research first, implement second
- ✅ Verify with official documentation
- ✅ Use current best practices
- ✅ Check for breaking changes
- ✅ Validate syntax and types

## Enforcement

This research-first approach is **NON-NEGOTIABLE**. Any implementation without proper research is considered incomplete and must be revised.
