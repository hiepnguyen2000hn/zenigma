'use client';

import { Toaster } from 'react-hot-toast';

export function ToastProvider() {
    return (
        <Toaster
            position="top-right"
            toastOptions={{
                // Default options
                duration: 4000,
                style: {
                    background: '#1f2937', // gray-800
                    color: '#fff',
                    border: '1px solid #374151', // gray-700
                    borderRadius: '0.75rem',
                    padding: '12px 16px',
                    fontSize: '14px',
                },
                // Success toast style
                success: {
                    duration: 3000,
                    iconTheme: {
                        primary: '#10b981', // green-500
                        secondary: '#fff',
                    },
                    style: {
                        border: '1px solid #10b981',
                    },
                },
                // Error toast style
                error: {
                    duration: 5000,
                    iconTheme: {
                        primary: '#ef4444', // red-500
                        secondary: '#fff',
                    },
                    style: {
                        border: '1px solid #ef4444',
                    },
                },
                // Loading toast style
                loading: {
                    iconTheme: {
                        primary: '#14b8a6', // teal-500
                        secondary: '#fff',
                    },
                    style: {
                        border: '1px solid #14b8a6',
                    },
                },
            }}
        />
    );
}
