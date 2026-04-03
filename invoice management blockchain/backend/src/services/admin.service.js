const path = require('path')
const { spawn } = require('child_process')

async function seedDemoData(options = {}) {
  const clients = Math.min(Math.max(Number(options.clients || 30), 1), 500)
  const invoices = Math.min(Math.max(Number(options.invoices || 200), 1), 5000)
  const maxPayments = Math.min(Math.max(Number(options.maxPayments || 3), 0), 12)

  const scriptPath = path.resolve(__dirname, '../../scripts/seed-faker.js')
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        FAKER_CLIENTS: String(clients),
        FAKER_INVOICES: String(invoices),
        FAKER_MAX_PAYMENTS: String(maxPayments),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data) => { stdout += data.toString() })
    child.stderr.on('data', (data) => { stderr += data.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, message: 'Demo data generated', output: stdout.trim() })
      } else {
        reject(new Error(stderr.trim() || 'Failed to seed demo data'))
      }
    })
  })
}

module.exports = {
  seedDemoData,
}
