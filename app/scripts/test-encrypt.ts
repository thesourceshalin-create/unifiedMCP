process.env.ENCRYPTION_KEY = '0'.repeat(64)

// Dynamic import to avoid module resolution issues
async function main() {
  const { encrypt, decrypt } = await import('../lib/encrypt.js')
  const original = { apiKey: 'secret', baseId: 'app123' }
  const ciphertext = encrypt(original)
  const decrypted = decrypt(ciphertext)
  const ok = JSON.stringify(decrypted) === JSON.stringify(original)
  if (!ok) throw new Error('Round-trip failed!')
  console.log('✅ Encrypt/decrypt OK:', decrypted)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
