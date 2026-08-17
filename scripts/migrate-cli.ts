import { runMigrations } from '../server/database/migrate'

const applied = await runMigrations()
// eslint-disable-next-line no-console
console.log(JSON.stringify({ level: 'info', msg: 'migrations applied', applied }))
