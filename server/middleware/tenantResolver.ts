import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { companies } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Extend Express Request to include companyId
declare global {
  namespace Express {
    interface Request {
      companyId?: number;
      company?: typeof companies.$inferSelect;
    }
  }
}

/**
 * Middleware to resolve tenant (company) from subdomain or header
 * Sets req.companyId and req.company for use in subsequent middleware/routes
 */
export async function tenantResolver(req: Request, res: Response, next: NextFunction) {
  try {
    let companyId: number | null = null;

    // Method 1: Try to get company from x-company-id header
    const companyIdHeader = req.headers['x-company-id'];
    if (companyIdHeader) {
      const parsedId = parseInt(String(companyIdHeader), 10);
      if (!isNaN(parsedId)) {
        companyId = parsedId;
      }
    }

    // Method 2: If no header, try to resolve from subdomain
    if (!companyId) {
      const hostname = req.hostname || req.get('host') || '';
      // Extract subdomain from hostname (e.g., "acme.localhost:5000" -> "acme")
      const subdomainMatch = hostname.match(/^([^.]+)\./);
      if (subdomainMatch) {
        const subdomain = subdomainMatch[1];
        
        // Find company by domain/subdomain
        const companyResults = await db
          .select()
          .from(companies)
          .where(eq(companies.domain, subdomain))
          .limit(1);
        
        if (companyResults.length > 0) {
          companyId = companyResults[0].id;
          req.company = companyResults[0];
        }
      }
    }

    // Method 3: If we have companyId from header, fetch the company
    if (companyId && !req.company) {
      const companyResults = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);
      
      if (companyResults.length > 0) {
        req.company = companyResults[0];
      }
    }

    // Set companyId on request for use in routes
    if (companyId) {
      req.companyId = companyId;
      // Only log in debug mode
      if (process.env.DEBUG_TENANT === 'true') {
        console.log('Tenant resolved:', { companyId, companyName: req.company?.name });
      }
    } else {
      // Only log warnings for API routes or in debug mode
      if (req.path.startsWith('/api/') && process.env.DEBUG_TENANT === 'true') {
        console.warn('No tenant (company) resolved from request:', {
          hostname: req.hostname,
          headers: { 'x-company-id': req.headers['x-company-id'] },
          path: req.path,
        });
      }
    }

    next();
  } catch (error) {
    console.error('Error in tenantResolver:', error);
    // Don't block request, but log the error
    next();
  }
}

