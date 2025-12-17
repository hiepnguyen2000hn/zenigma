'use client';

import { useState } from 'react';

interface WalletInitProofResult {
  success: boolean;
  verified: boolean;
  proof: number[];
  publicInputs: {
    initial_commitment: string;
  };
  randomness: string;
  new_state: {
    available_balances: string[];
    reserved_balances: string[];
    orders_list: (null | any)[];
    fees: string;
    nonce: string;
  };
  timing?: {
    total: number;
    witness: number;
    proof: number;
    verify: number;
  };
}

/**
 * Example component demonstrating direct API call (no hook)
 *
 * Usage:
 * - Import this component in any page
 * - User enters their secret key
 * - Click "Generate Proof" to trigger ZK proof generation
 * - Results will be displayed including timing and verification status
 */
export default function WalletProofExample() {
  const [userSecret, setUserSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WalletInitProofResult | null>(null);

  const handleGenerateProof = async () => {
    if (!userSecret) {
      alert('Please enter a user secret');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/proof/generate-wallet-init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userSecret }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to generate proof');
      }

      const data: WalletInitProofResult = await response.json();
      setResult(data);
      console.log('Proof generated successfully:', data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error generating wallet init proof:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Wallet Initialization Proof Generator</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="userSecret" className="block text-sm font-medium mb-2">
              User Secret Key
            </label>
            <input
              id="userSecret"
              type="text"
              value={userSecret}
              onChange={(e) => setUserSecret(e.target.value)}
              placeholder="Enter your secret key (e.g., 123456789)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              This is a demo. In production, this should come from your wallet/authentication.
            </p>
          </div>

          <button
            onClick={handleGenerateProof}
            disabled={loading || !userSecret}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              loading || !userSecret
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? 'Generating Proof...' : 'Generate Proof'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-red-800 font-medium mb-1">Error</h3>
            <p className="text-red-600 text-sm">{error}</p>
            <p className="text-xs text-red-500 mt-2">
              Make sure the circuit file exists in circuits/wallet_init_state.json
            </p>
          </div>
        )}

        {/* Success Display */}
        {result && (
          <div className="mt-4 space-y-4">
            <div className={`p-4 rounded-lg border ${
              result.verified
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <h3 className={`font-medium mb-1 ${
                result.verified ? 'text-green-800' : 'text-yellow-800'
              }`}>
                {result.verified ? '✅ Proof Verified Successfully!' : '⚠️ Proof Generated (Not Verified)'}
              </h3>
            </div>

            {/* Timing Information */}
            {result.timing && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-blue-800 font-medium mb-2">⏱️ Performance Metrics</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-blue-600">Total Time:</span>
                    <span className="ml-2 font-mono">{result.timing.total}ms</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Witness Gen:</span>
                    <span className="ml-2 font-mono">{result.timing.witness}ms</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Proof Gen:</span>
                    <span className="ml-2 font-mono">{result.timing.proof}ms</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Verification:</span>
                    <span className="ml-2 font-mono">{result.timing.verify}ms</span>
                  </div>
                </div>
              </div>
            )}

            {/* Proof Details */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-gray-800 font-medium mb-2">📋 Proof Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Initial Commitment:</span>
                  <p className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">
                    {result.publicInputs.initial_commitment}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Randomness:</span>
                  <p className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">
                    {result.randomness}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Proof Size:</span>
                  <p className="font-mono text-xs mt-1">
                    {result.proof.length} bytes
                  </p>
                </div>
              </div>
            </div>

            {/* Wallet State */}
            <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <summary className="cursor-pointer font-medium text-gray-800">
                🔍 View Wallet State (Click to expand)
              </summary>
              <pre className="mt-2 text-xs bg-white p-3 rounded overflow-x-auto">
                {JSON.stringify(result.new_state, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
        <h3 className="font-medium mb-2">📝 How to call API directly in your component:</h3>
        <pre className="bg-white p-3 rounded overflow-x-auto">
{`function YourComponent() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleClick = async () => {
    setLoading(true);
    const response = await fetch('/api/proof/generate-wallet-init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userSecret: 'your-secret-key' })
    });
    const data = await response.json();
    setResult(data);
    setLoading(false);

    if (data.verified) {
      // Use data.publicInputs.initial_commitment
      // Use data.randomness
      // Use data.new_state
    }
  };

  return <button onClick={handleClick} disabled={loading}>Generate</button>;
}`}
        </pre>
      </div>
    </div>
  );
}
