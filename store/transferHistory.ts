import { atom } from 'jotai';
import { appStore } from '@/providers/JotaiProvider';

export const transferHistoryRefetchTriggerAtom = atom<number>(0);

export function triggerTransferHistoryRefetch(): void {
  const currentValue = appStore.get(transferHistoryRefetchTriggerAtom);
  appStore.set(transferHistoryRefetchTriggerAtom, currentValue + 1);
}
