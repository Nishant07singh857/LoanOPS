import fs from 'fs';
import { execSync } from 'child_process';
const files = execSync('find src/app/api -name route.ts').toString().split('\n').filter(Boolean).sort();

console.log('| Route File | Method(s) | Auth Check | Role Check | Ownership/Params | Strict Zod |');
console.log('|---|---|---|---|---|---|');

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const methods = [];
  if (content.includes('export const GET =')) methods.push('GET');
  if (content.includes('export const POST =')) methods.push('POST');
  if (content.includes('export const PATCH =')) methods.push('PATCH');
  if (content.includes('export const DELETE =')) methods.push('DELETE');
  
  let auth = 'None';
  if (content.includes('requireOwner')) auth = 'Owner';
  else if (content.includes('requireAgent')) auth = 'Agent';
  else if (content.includes('requireCandidate')) auth = 'Candidate';
  else if (content.includes('getSession') || content.includes('requireAuth')) auth = 'Session';
  
  let role = 'N/A';
  if (auth !== 'None' && auth !== 'Session') role = auth;
  
  let own = 'N/A';
  if (content.includes('organizationId:')) own = 'Org Scoped';
  if (content.includes('candidateId:')) own += ' / Candidate Scoped';
  
  let zod = 'N/A';
  if (content.includes('z.object')) {
    zod = content.includes('.strict()') ? 'Yes' : 'No';
  }
  
  console.log('| ' + f + ' | ' + methods.join(',') + ' | ' + auth + ' | ' + role + ' | ' + own + ' | ' + zod + ' |');
}
