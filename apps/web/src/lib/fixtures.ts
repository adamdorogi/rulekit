const motor = [
  {
    label: 'Young Driver High Value Vehicle',
    input: { applicant: { age: 22 }, vehicle: { value_aud: 92000 }, history: { at_fault_claims: 1 } },
  },
  {
    label: 'Multiple At-Fault Claims',
    input: { applicant: { age: 41 }, vehicle: { value_aud: 28500 }, history: { at_fault_claims: 3 } },
  },
  {
    label: 'Standard Motor Risk',
    input: { applicant: { age: 38 }, vehicle: { value_aud: 34000 }, history: { at_fault_claims: 0 } },
  },
];

const merchant = [
  {
    label: 'Verified Australian Merchant',
    input: { merchant: { country: 'AU', monthly_volume_aud: 42000, chargeback_rate: 0.008, kyc_verified: true } },
  },
  {
    label: 'High Volume Merchant',
    input: { merchant: { country: 'AU', monthly_volume_aud: 280000, chargeback_rate: 0.02, kyc_verified: true } },
  },
  {
    label: 'Unverified Merchant',
    input: { merchant: { country: 'NZ', monthly_volume_aud: 22000, chargeback_rate: 0.004, kyc_verified: false } },
  },
];

export function projectFixtures(slug: string) {
  if (slug === 'motor-au') return motor;
  if (slug === 'merchant-kyc') return merchant;
  return [{ label: 'Empty payload', input: {} }];
}
