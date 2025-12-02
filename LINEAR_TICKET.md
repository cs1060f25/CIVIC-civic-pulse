# UI/UX Readability and Layout Improvements

## Summary
Comprehensive fixes to improve text readability, button visibility, and layout across the CivicPulse frontend, particularly on the search, document detail, and brief pages.

## Changes Made

### 1. Impact Badge Visibility
- **Issue**: Documents with `null` impact level were showing a green "Low" badge
- **Fix**: 
  - Updated `ImpactBadge` component to accept `null` and return `null` when impact is not set
  - Desktop view now shows "—" when impact is `null` (no badge displayed)
  - Updated both `search/page.tsx` and `item/[id]/page.tsx`

### 2. Table Alignment
- **Issue**: Impact column and other table cells were misaligned vertically
- **Fix**:
  - Added `flex items-center` to all table headers and data cells
  - Fixed Entity/County column to use `flex flex-col justify-center` for two-line content
  - Removed `leading-7` from row container that was causing misalignment
  - All columns now properly aligned at the same height

### 3. Button Visibility and Readability
- **Issue**: Save and "Add to Brief" buttons had invisible or unreadable text
- **Fix**:
  - Changed Button component from CSS variables (`bg-[--color-brand-600]`) to explicit Tailwind classes (`bg-blue-600`)
  - Primary buttons now have explicit blue background with white text
  - Removed redundant `text-white` className props (primary buttons already have white text)
  - Updated focus ring to use `focus-visible:ring-blue-500`

### 4. Document Type Filter Readability
- **Issue**: Active filter buttons had white text on purple background (hard to read)
- **Fix**:
  - Updated CSS to use dark purple text (`#312e81`) on light purple background (`#e0e7ff`)
  - Added `!important` to ensure it overrides other styles
  - Inactive chips now use `text-gray-900` for consistency

### 5. Brief Page Readability
- **Issue**: Multiple text elements were hard to read due to light colors
- **Fix**:
  - Impact badges: Changed from light text (`text-red-300`, `text-amber-300`, `text-green-300`) to dark text (`text-red-800`, `text-amber-800`, `text-green-800`) on light backgrounds
  - Document type badges: Changed to `border-gray-300 bg-white text-gray-900`
  - Topic tags: Changed from `text-indigo-200` to `text-indigo-800` on `bg-indigo-100`
  - Impact distribution boxes: Updated to dark text on light backgrounds
  - All muted text: Changed from `text-[--color-muted]` to `text-gray-600`
  - Labels and headings: Changed to `text-gray-900` for better contrast
  - Links: Changed to `text-blue-600` for better visibility

### 6. Search Page Summary Layout
- **Issue**: Document summaries were constrained to title column width
- **Fix**:
  - Restructured table to show summary in a separate full-width row
  - Summary now spans all 12 columns using `col-span-12`
  - Removed `line-clamp-2` so full summary is visible
  - Title column no longer constrained by summary width

## Files Changed

1. `civicpulse/src/app/components/ui.tsx`
   - Updated Button component to use explicit Tailwind colors
   - Fixed primary button visibility

2. `civicpulse/src/app/search/page.tsx`
   - Fixed impact badge null handling
   - Fixed table alignment
   - Restructured summary to span full width
   - Updated document type filter colors

3. `civicpulse/src/app/item/[id]/page.tsx`
   - Fixed impact badge null handling
   - Removed redundant button className props

4. `civicpulse/src/app/brief/page.tsx`
   - Updated all text colors for readability
   - Fixed impact badges, document type badges, topic tags
   - Updated impact distribution boxes

5. `civicpulse/src/app/globals.css`
   - Updated active chip state CSS for document type filters

## Testing
- [x] Verify impact badges show "—" for null impact levels
- [x] Verify table columns are properly aligned
- [x] Verify all buttons have readable text
- [x] Verify document type filters are readable when active
- [x] Verify brief page has readable text throughout
- [x] Verify summaries span full table width on search page

## Deployment
1. Upload database to Kubernetes: `.\upload-db-to-k8s.ps1`
2. Build and push frontend image: `cd infrastructure && .\build-images.ps1`
3. Update Kubernetes: `pulumi up --yes`
4. Restart frontend deployment: `kubectl rollout restart deployment/frontend -n civicpulse-104c2bda`

## Related Issues
- Button visibility issues on document detail page
- Text readability issues across multiple pages
- Table alignment issues on search page
- Impact badge showing incorrect values

