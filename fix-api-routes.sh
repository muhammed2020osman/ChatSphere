#!/bin/bash

# Script to fix API routes with proper dynamic export
cd /mnt/hp/software_link/ChatSphere

# Find all API route files that need dynamic export
find app/api -name "route.ts" -exec grep -l "requireAuth\|getAuthenticatedUser\|headers" {} \; | while read file; do
  echo "Fixing $file..."
  
  # Create a temporary file with proper structure
  temp_file=$(mktemp)
  
  # Extract imports (lines starting with import)
  grep "^import" "$file" > "$temp_file"
  
  # Add empty line
  echo "" >> "$temp_file"
  
  # Add dynamic export
  echo "// Force dynamic rendering" >> "$temp_file"
  echo "export const dynamic = 'force-dynamic';" >> "$temp_file"
  echo "" >> "$temp_file"
  
  # Add the rest of the file (skip import lines and any existing dynamic exports)
  grep -v "^import" "$file" | grep -v "export const dynamic" | grep -v "^// Force dynamic rendering" | grep -v "^$" >> "$temp_file"
  
  # Replace original file
  mv "$temp_file" "$file"
  
  echo "Fixed $file"
done

echo "All API routes fixed!"
