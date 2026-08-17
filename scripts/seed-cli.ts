import { seedFromEnv } from '../server/database/seed'

const created = await seedFromEnv()
// eslint-disable-next-line no-console
console.log(JSON.stringify({ level: 'info', msg: 'seed done', created }))
