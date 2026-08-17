import { mailConfigFromEnv, sendMail } from '../server/utils/mailer'

/**
 * Testversand gegen das konfigurierte Relay:
 *   npm run mail:test -- empfaenger@example.org
 *
 * Liest die Zugangsdaten aus .env (Gmail, IONOS oder ein anderes SMTP-Relay) und schickt
 * genau eine Nachricht. Zugangsdaten werden dabei nie ausgegeben.
 */
const recipient = process.argv[2]

if (!recipient) {
  console.error('Bitte eine Empfängeradresse angeben: npm run mail:test -- name@example.org')
  process.exit(1)
}

const config = mailConfigFromEnv()

if (!config) {
  console.error('Kein Relay konfiguriert. NUXT_SMTP_HOST und NUXT_SMTP_FROM in .env setzen.')
  process.exit(1)
}

console.log(`Sende Testmail über ${config.host}:${config.port} als ${config.from} …`)

const result = await sendMail(
  {
    to: recipient,
    subject: 'Testmail der Lehrgangsverwaltung',
    text: 'Diese Nachricht bestätigt, dass der Mailversand funktioniert.',
  },
  config,
)

if (result.ok) {
  console.log('Zugestellt an das Relay.')
}
else {
  console.error(`Fehlgeschlagen: ${result.error}`)
  process.exit(1)
}
