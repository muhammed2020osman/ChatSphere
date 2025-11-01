// Extract @mentions from message content
export function extractMentions(content: string): string[] {
  if (!content) return [];
  
  // Match @username patterns (alphanumeric + underscore + hyphen)
  const mentionRegex = /@([\w-]+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    const username = match[1];
    if (!mentions.includes(username)) {
      mentions.push(username);
    }
  }
  
  return mentions;
}

// Find user IDs from usernames (email prefixes)
export async function findUserIdsByUsernames(usernames: string[], allUsers: any[]): Promise<string[]> {
  const userIds: string[] = [];
  
  for (const username of usernames) {
    // Try to find user by email prefix or full name
    const user = allUsers.find(u => {
      const emailPrefix = u.email?.split('@')[0]?.toLowerCase();
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().replace(/\s+/g, '');
      const firstLast = `${u.firstName || ''}${u.lastName || ''}`.toLowerCase();
      
      return emailPrefix === username.toLowerCase() || 
             fullName === username.toLowerCase() ||
             firstLast === username.toLowerCase();
    });
    
    if (user && !userIds.includes(user.id)) {
      userIds.push(user.id);
    }
  }
  
  return userIds;
}

// Check if user is admin
export function isAdmin(user: { role?: string | null }): boolean {
  return user?.role === 'admin';
}

// Middleware to require admin role
export function requireAdmin(user: any) {
  if (!user || !isAdmin(user)) {
    throw new Error('Admin access required');
  }
}

// Check if user is company_manager
export function isCompanyManager(user: { role?: string | null }): boolean {
  return user?.role === 'company_manager';
}

// Middleware to require company_manager role
export function requireCompanyManager(user: any) {
  if (!user || !isCompanyManager(user)) {
    throw new Error('Company manager access required');
  }
}
