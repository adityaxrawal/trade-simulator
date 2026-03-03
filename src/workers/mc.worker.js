import { runMonteCarlo } from '../utils/simulation.js';

self.onmessage = async (e) => {
    try {
        const { params, simCount } = e.data;
        const results = await runMonteCarlo(params, simCount);
        self.postMessage({ type: 'SUCCESS', results });
    } catch (error) {
        let errorMsg = String(error);
        if (error instanceof Error) {
            errorMsg = error.message;
        } else if (error && typeof error === 'object' && error.message) {
            errorMsg = error.message;
        }
        self.postMessage({ type: 'ERROR', error: errorMsg });
    }
};
