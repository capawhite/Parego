export function generateQRCodeUrl(tournamentJoinUrl: string): string {
  // Use QR Server API for QR code generation
  const encoded = encodeURIComponent(tournamentJoinUrl)
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}`
}

export function generateQRCode(tournamentJoinUrl: string): string {
  return generateQRCodeUrl(tournamentJoinUrl)
}
