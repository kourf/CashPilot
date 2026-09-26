import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type {
  SubscriptionOptimizationRequest,
  SubscriptionOptimizationResponse
} from '../types/index';

export const optimizeSubscription = async (
  request: SubscriptionOptimizationRequest
): Promise<SubscriptionOptimizationResponse> => {
  try {
    const optimizeFn = httpsCallable<SubscriptionOptimizationRequest, any>(
      functions,
      'optimizeSubscription'
    );

    const result = await optimizeFn(request);

    // Cloud functions returning standard { success: boolean, data: T }
    // Need to extract the data part as response
    if (result.data?.success) {
        return result.data.data as SubscriptionOptimizationResponse;
    }

    throw new Error('Unexpected response format from optimization function');

  } catch (error) {
    console.error('Error optimizing subscription:', error);
    throw error;
  }
};
