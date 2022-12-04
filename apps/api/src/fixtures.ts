import { Ruleset } from '@rulekit/engine'

export const motorInput = {
  applicant: { age: 22 },
  vehicle: { value_aud: 92000 },
  history: { at_fault_claims: 1 },
}

export const motorAU: Ruleset = {
  mode: 'first_match',
  defaultOutcome: 'allow',
  defaultOutputs: { tier: 'standard' },
  rules: [
    {
      id: 'claims-limit',
      name: 'At-fault claims limit',
      when: { field: 'history.at_fault_claims', op: 'gte', value: 2 },
      outcome: 'deny',
      outputs: { reason: 'claims_frequency' },
    },
    {
      id: 'young-high-value',
      name: 'Young driver, high-value vehicle',
      when: { all: [
        { field: 'applicant.age', op: 'lt', value: 25 },
        { field: 'vehicle.value_aud', op: 'gt', value: 85000 },
      ] },
      outcome: 'review',
      outputs: { queue: 'motor-underwriting', reason: 'young_driver_high_value' },
    },
    {
      id: 'high-value',
      name: 'High-value vehicle',
      when: { field: 'vehicle.value_aud', op: 'gt', value: 85000 },
      outcome: 'review',
      outputs: { queue: 'motor-underwriting', reason: 'vehicle_value' },
    },
  ],
}

export const merchantKYC: Ruleset = {
  mode: 'all_matches',
  defaultOutcome: 'allow',
  rules: [
    {
      id: 'kyc-not-verified',
      name: 'KYC verification missing',
      when: { field: 'merchant.kyc_verified', op: 'neq', value: true },
      outcome: 'deny',
      outputs: { id_check: 'required' },
    },
    {
      id: 'high-merchant-volume',
      name: 'Review monthly volume above AUD 75,000',
      when: { field: 'merchant.monthly_volume_aud', op: 'gt', value: 75000 },
      outcome: 'review',
      outputs: { volume_review: true },
    },
    {
      id: 'chargeback-limit',
      name: 'Review chargeback rate at 1 percent',
      when: { field: 'merchant.chargeback_rate', op: 'gte', value: 0.01 },
      outcome: 'review',
      outputs: { chargeback_review: true },
    },
  ],
}
