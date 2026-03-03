import { runMonteCarlo } from '../utils/simulation.js';

self.onmessage = async (e) => {
    try {
        const { params, simCount } = e.data;
        const results = await runMonteCarlo(params, simCount);
        self.postMessage({ type: 'SUCCESS', results });
    } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
    }
};
