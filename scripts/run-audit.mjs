import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function run(cmd, allowFail = false) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' }).trim();
  } catch (err) {
    if (allowFail) return err.stdout ? err.stdout.toString().trim() : err.message;
    throw err;
  }
}

function grep(pattern, files = '.') {
  return run(`grep -rn "${pattern}" ${files} || true`, true);
}

const report = [];
report.push('# STEP 1: AUDIT RAW PROOFS');

report.push('\n## A1. Build and Tooling');
report.push('tsc: ' + run('npx tsc --noEmit', true));
report.push('eslint: ' + run('npx eslint .', true));
report.push('test:unit:\n' + run('npm run test:unit', true).split('\n').slice(-5).join('\n'));
report.push('build:\n' + run('npm run build', true).split('\n').slice(-5).join('\n'));

report.push('\n## A2. Prisma Migrate Status');
report.push(run('npx prisma migrate status', true));
report.push(run('npx prisma validate', true));

report.push('\n## A3. npm audit');
report.push(run('npm audit --omit=dev', true));

report.push('\n## A4. Secrets in Repo');
report.push('git check-ignore .env: ' + run('git check-ignore .env', true));
report.push('gitleaks: ' + run('gitleaks detect -v || echo "gitleaks not found or failed"', true));

report.push('\n## B5. Password Policy & Hashing');
report.push(grep('hashPassword', 'src/lib/server/auth.ts'));
report.push(grep('validatePasswordPolicy', 'src/lib/server/auth.ts'));

report.push('\n## B6. Cookie Flags & Session');
report.push(grep('httpOnly', 'src/lib/server/auth.ts'));
report.push(grep('passwordChangedAt', 'src/lib/server/auth.ts src/app/api/auth'));

report.push('\n## C14. Mass Assignment (Strict Zod)');
report.push(grep('z.object', 'src/app/api'));
report.push(grep('strict', 'src/app/api'));

report.push('\n## F24. Aadhaar Storage');
report.push(grep('aadhaar', 'src/app/api/apply'));
report.push(grep('aadhaar', 'src/app/api/candidate/application'));
report.push(grep('aadhaar', 'prisma/schema.prisma'));

report.push('\n## G28. Float Math in Financials');
report.push(grep('parseFloat\\|toFixed\\|Math.round', 'src/lib/server/financial.ts'));
report.push(grep('number', 'prisma/schema.prisma | grep Float || echo "No Floats"'));

report.push('\n## I38. TODOs and console.log');
report.push(grep('console.log', 'src'));
report.push(grep('TODO', 'src'));

// Audit output is a local run artifact, not source: write it under
// audit-output/ (gitignored) instead of polluting the repository root.
const outputDir = path.join(process.cwd(), 'audit-output');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'audit-raw-proofs.txt');
fs.writeFileSync(outputPath, report.join('\n'));
console.log(`Audit script finished. Report written to ${outputPath}`);
