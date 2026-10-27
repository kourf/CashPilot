import React from 'react';
import { 
  BudgetAndCostOfLivingDrawer, 
  DEFAULT_ITEMS as DEFAULT_POSTS, 
  getCategoryIcon, 
  type BudgetItemRow 
} from './BudgetAndCostOfLivingDrawer';
import type { BankTransaction } from '../lib/bankUtils';

export interface BudgetTrackingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  monthTransactions: BankTransaction[];
  allTransactions: BankTransaction[];
}

export { DEFAULT_POSTS, getCategoryIcon, type BudgetItemRow };

export const BudgetTrackingDrawer: React.FC<BudgetTrackingDrawerProps> = (props) => {
  return (
    <BudgetAndCostOfLivingDrawer
      isOpen={props.isOpen}
      onClose={props.onClose}
      onBack={props.onBack}
      initialTab="budget_tracking"
      monthTransactions={props.monthTransactions}
      allTransactions={props.allTransactions}
      bankTransactions={props.allTransactions}
    />
  );
};
