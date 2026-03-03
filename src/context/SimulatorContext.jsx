import React, { createContext, useContext } from "react";

const SimulatorContext = createContext(null);

/**
 * Hook to access the simulation state and handlers from anywhere within the SimulatorProvider.
 * @returns {Object} The simulation context value.
 */
export const useSimulatorContext = () => {
  const context = useContext(SimulatorContext);
  if (!context) {
    throw new Error(
      "useSimulatorContext must be used within a SimulatorProvider",
    );
  }
  return context;
};

/**
 * Provider component for the SimulatorContext.
 * @param {Object} props
 * @param {Object} props.value The simulation object to provide.
 * @param {React.ReactNode} props.children
 * @returns {React.ReactElement}
 */
export const SimulatorProvider = ({ value, children }) => {
  return (
    <SimulatorContext.Provider value={value}>
      {children}
    </SimulatorContext.Provider>
  );
};
