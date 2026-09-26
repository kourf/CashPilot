export interface SubscriptionOptimizationRequest {
  transactionText: string;
  amount: number;
  userContext?: string;
}

export interface SubscriptionOptimizationResponse {
  status: 'success' | 'no_optimization' | 'unidentified';
  market: 'FR' | 'CH';
  optimizationType: 'same_provider' | 'competitor' | null;
  suggestedProvider: string | null;
  suggestedPlan: string | null;
  estimatedMonthlySavings: number | null;
  contextualChips: string[];
  explanation: string;
}
