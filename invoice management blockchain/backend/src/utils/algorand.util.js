const algosdk = require('algosdk')

function isValidAlgorandAddress(address) {
  if (!address || typeof address !== 'string') return false
  return algosdk.isValidAddress(address.trim())
}

module.exports = {
  isValidAlgorandAddress
}
