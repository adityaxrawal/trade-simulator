import { runSimulation } from '../utils/simulation.js';

self.onmessage = async (e) => {
    try {
        const { jobId, params } = e.data;
        // The worker will await the simulated block (which yields internally if changed)
        const result = await runSimulation(params);
        self.postMessage({ type: 'SUCCESS', result, jobId });
    } catch (error) {
        self.postMessage({ type: 'ERROR', error: error instanceof Error ? error.message : String(error), jobId: e.data.jobId });
    }
};
