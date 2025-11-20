/**
 * Lazy validation for Solairus program IDs during payment/withdrawal operations
 */

interface ProgramValidationResult {
  isValid: boolean
  errors: string[]
  programIds: {
    main?: string
    pay?: string
  }
}

export function validateSolairusProgramIds(): ProgramValidationResult {
  const errors: string[] = []
  const programIds: { main?: string; pay?: string } = {}

  // Validate SolairusPay program ID (required for payments/withdrawals)
  const payProgramId = import.meta.env.VITE_SOLAIRUS_PAY_PROGRAM_ID
  if (!payProgramId) {
    errors.push('VITE_SOLAIRUS_PAY_PROGRAM_ID is required for payment/withdrawal operations')
  } else {
    try {
      // Basic validation that it looks like a valid Solana program ID
      if (!payProgramId.match(/^[A-Za-z0-9]{43,44}$/)) {
        errors.push(`Invalid VITE_SOLAIRUS_PAY_PROGRAM_ID format: ${payProgramId}`)
      } else {
        programIds.pay = payProgramId
      }
    } catch (error) {
      errors.push(`Error validating VITE_SOLAIRUS_PAY_PROGRAM_ID: ${error}`)
    }
  }

  // Solairus Main program ID is optional (legacy, not used in current flows)
  const mainProgramId = import.meta.env.VITE_SOLAIRUS_MAIN_PROGRAM_ID
  if (mainProgramId) {
    try {
      if (!mainProgramId.match(/^[A-Za-z0-9]{43,44}$/)) {
        errors.push(`Invalid VITE_SOLAIRUS_MAIN_PROGRAM_ID format: ${mainProgramId}`)
      } else {
        programIds.main = mainProgramId
      }
    } catch (error) {
      errors.push(`Error validating VITE_SOLAIRUS_MAIN_PROGRAM_ID: ${error}`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    programIds
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