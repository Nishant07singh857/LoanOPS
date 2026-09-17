// Quick DB connectivity test
import { db } from '@/lib/db'

async function main() {
  const orgCount = await db.organization.count()
  const userCount = await db.user.count()
  console.log('Connected to Neon PostgreSQL successfully')
  console.log('Organizations:', orgCount)
  console.log('Users:', userCount)
}

main()
  .catch((e) => {
    console.error('DB connection failed:', e.message)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
