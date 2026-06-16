/**
 * Lazy validation for Solairus program IDs during payment/withdrawal operations
 */

import idl from '@/idl/solairus_pay.json'

interface ProgramValidationResult {
  isValid: boolean
  errors: string[]
  programIds: {
    pay?: string
  }
}

export function validateSolairusProgramIds(): ProgramValidationResult {
  const errors: string[] = []
  const programIds: { pay?: string } = {}

  const payEnv = import.meta.env.VITE_SOLAIRUS_PAY_PROGRAM_ID
  const rawIdl = idl as unknown as { address?: string; metadata?: { address?: string } }
  const idlAddress = rawIdl.address ?? rawIdl.metadata?.address

  if (payEnv) {
    try {
      if (!payEnv.match(/^[A-Za-z0-9]{43,44}$/)) {
        errors.push(`Invalid VITE_SOLAIRUS_PAY_PROGRAM_ID format: ${payEnv}`)
      } else {
        programIds.pay = payEnv
      }
    } catch (error) {
      errors.push(`Error validating VITE_SOLAIRUS_PAY_PROGRAM_ID: ${error}`)
    }
  } else if (idlAddress && /^[A-Za-z0-9]{43,44}$/.test(idlAddress)) {
    programIds.pay = idlAddress
    try { console.warn('Using IDL address as fallback for SolairusPay program ID') } catch {}
  } else {
    errors.push('VITE_SOLAIRUS_PAY_PROGRAM_ID is required for payment/withdrawal operations')
  }

  return {
    isValid: errors.length === 0,
    errors,
    programIds,
  }
}

export function getSolairusPayProgramId(): string {
  const validation = validateSolairusProgramIds()
  if (!validation.isValid) {
    throw new Error(`SolairusPay program validation failed: ${validation.errors.join(', ')}`)
  }
  return validation.programIds.pay!
}

export function ensureSolairusProgramsInitialized(): void {
  const validation = validateSolairusProgramIds()
  if (!validation.isValid) {
    throw new Error(`Solairus program initialization failed: ${validation.errors.join(', ')}`)
  }
}