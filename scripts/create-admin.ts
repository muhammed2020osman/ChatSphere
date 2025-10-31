#!/usr/bin/env tsx

import 'dotenv/config';
import { findAuthUserByEmail, createAuthUser } from '../server/auth/user.model';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'admin@gmail.com';
  const password = '22222222';
  const name = 'Admin User';

  try {
    console.log(`🔍 Checking if user ${email} exists...`);
    const existingUser = await findAuthUserByEmail(email);
    
    if (existingUser) {
      console.log(`✅ User ${email} already exists with ID: ${existingUser.id}`);
      console.log('User details:', {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        hasPassword: !!existingUser.password_hash,
      });
      
      // Update password if needed
      console.log('🔐 Updating password...');
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Import pool directly
      const { pool } = await import('../server/db');
      await pool.execute(
        'UPDATE users SET password_hash = ? WHERE email = ?',
        [passwordHash, email]
      );
      
      console.log('✅ Password updated successfully');
      console.log(`\n📝 Login credentials:`);
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    } else {
      console.log(`👤 Creating new admin user ${email}...`);
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await createAuthUser({
        email,
        passwordHash,
        name,
      });
      
      console.log('✅ Admin user created successfully!');
      console.log('User details:', {
        id: user.id,
        email: user.email,
        name: user.name,
      });
      
      // Set role to admin for the first user
      const { pool } = await import('../server/db');
      await pool.execute(
        'UPDATE users SET role = ? WHERE email = ?',
        ['admin', email]
      );
      console.log('✅ Role set to admin');
      
      console.log(`\n📝 Login credentials:`);
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    }
    
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message || error);
    console.error(error);
    process.exit(1);
  }
}

main();

