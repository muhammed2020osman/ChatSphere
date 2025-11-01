import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { User } from "@shared/schema"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get user initials from name field
 * - If name has multiple words: first letter of first word + first letter of last word
 * - If name is single word: first two letters
 */
export function getUserInitials(user?: User | { name?: string | null; email?: string | null }): string {
  if (!user) return "?";
  
  if (user.name) {
    const nameParts = user.name.trim().split(/\s+/);
    if (nameParts.length > 1) {
      // Multiple words: first letter of first word + first letter of last word
      const first = nameParts[0][0] || "";
      const last = nameParts[nameParts.length - 1][0] || "";
      return (first + last).toUpperCase();
    } else {
      // Single word: first two letters
      const name = nameParts[0];
      if (name.length >= 2) {
        return name.substring(0, 2).toUpperCase();
      }
      return name[0]?.toUpperCase() || "?";
    }
  }
  
  return user.email?.[0]?.toUpperCase() || "?";
}

/**
 * Get user display name
 */
export function getUserName(user?: User | { name?: string | null; email?: string | null; id?: string | number }): string {
  if (!user) return "Unknown";
  if (user.name) return user.name;
  if (user.email) return user.email;
  return "Unknown";
}
