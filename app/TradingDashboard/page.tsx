import { redirect } from 'next/navigation';

function Trading() {
    // Redirect to default pair
    redirect('/TradingDashboard/btc-usdc');
}

export default Trading;