import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n=== VAPID Keys Generated ===\n');
console.log('Public Key:');
console.log(vapidKeys.publicKey);
console.log('\nPrivate Key:');
console.log(vapidKeys.privateKey);
console.log('\n===========================\n');

// Read .env file if it exists
const envPath = path.resolve(__dirname, '..', '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
}

// Update or add VAPID keys to .env
const lines = envContent.split('\n');
const publicKeyIndex = lines.findIndex(line => line.startsWith('VAPID_PUBLIC_KEY='));
const privateKeyIndex = lines.findIndex(line => line.startsWith('VAPID_PRIVATE_KEY='));
const subjectIndex = lines.findIndex(line => line.startsWith('VAPID_SUBJECT='));

if (publicKeyIndex !== -1) {
  lines[publicKeyIndex] = `VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`;
} else {
  lines.push(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
}

if (privateKeyIndex !== -1) {
  lines[privateKeyIndex] = `VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`;
} else {
  lines.push(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
}

if (subjectIndex === -1) {
  lines.push(`VAPID_SUBJECT=mailto:admin@example.com`);
}

// Write updated .env file
fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');

console.log('✅ VAPID keys have been saved to .env file');
console.log('⚠️  Please update VAPID_SUBJECT with your email address\n');

