-- Add invitation_code column to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS invitation_code VARCHAR(50) NULL;

-- Add index on invitation_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_invitation_code ON companies(invitation_code);

