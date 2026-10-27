import React from 'react';
import { 
  BudgetAndCostOfLivingDrawer, 
  type BudgetAndCostOfLivingDrawerProps, 
  CATEGORY_GROUPS, 
  DEFAULT_ITEMS, 
  type ExpenseItem 
} from './BudgetAndCostOfLivingDrawer';
import type { BankTransaction } from '../lib/bankUtils';

export interface CostOfLivingBuilderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  bankTransactions: BankTransaction[];
  monthTransactions?: BankTransaction[];
  allTransactions?: BankTransaction[];
}

export { CATEGORY_GROUPS, DEFAULT_ITEMS, type ExpenseItem };

export const CostOfLivingBuilderDrawer: React.FC<CostOfLivingBuilderDrawerProps> = (props) => {
  return (
    <BudgetAndCostOfLivingDrawer
      isOpen={props.isOpen}
      onClose={props.onClose}
      onBack={props.onBack}
      initialTab="cost_of_living"
      bankTransactions={props.bankTransactions || props.allTransactions}
      allTransactions={props.allTransactions || props.bankTransactions}
      monthTransactions={props.monthTransactions}
    />
  );
};
