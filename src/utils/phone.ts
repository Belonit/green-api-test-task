export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  let phone: string

  if (digits.length === 10) {
    phone = `7${digits}`
  } else if (digits.length === 11 && digits.startsWith('8')) {
    phone = `7${digits.slice(1)}`
  } else {
    phone = digits
  }

  return /^(7\d{10}|375\d{9})$/.test(phone) ? phone : null
}
