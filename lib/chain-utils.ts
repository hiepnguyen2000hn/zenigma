import toast from 'react-hot-toast';

export const SEPOLIA_CHAIN_ID = 11155111;

/**
 * Ensure the user is on Sepolia chain before proceeding with an action.
 * If not on Sepolia, prompts the user to switch chains.
 *
 * @param chainId - Current chain ID from useChainId()
 * @param switchChainAsync - Function from useSwitchChain()
 * @param setProcessingStep - Optional function to update UI processing step
 * @returns true if on Sepolia or successfully switched, false otherwise
 *
 * @example
 * const chainId = useChainId();
 * const { switchChainAsync } = useSwitchChain();
 *
 * const canProceed = await ensureSepoliaChain(chainId, switchChainAsync, setProcessingStep);
 * if (!canProceed) {
 *   setIsProcessing(false);
 *   return;
 * }
 */
export async function ensureSepoliaChain(
  chainId: number | undefined,
  switchChainAsync: (args: { chainId: number }) => Promise<any>,
  setProcessingStep?: (step: string) => void
): Promise<boolean> {
  // If already on Sepolia, proceed
  if (chainId === SEPOLIA_CHAIN_ID) {
    return true;
  }

  // Show processing step if available
  setProcessingStep?.('Switching to Sepolia network...');

  try {
    await switchChainAsync({ chainId: SEPOLIA_CHAIN_ID });
    toast.success('Switched to Sepolia network');
    return true;
  } catch (error) {
    console.error('Failed to switch chain:', error);
    toast.error('Please switch to Sepolia network to continue');
    return false;
  }
}
