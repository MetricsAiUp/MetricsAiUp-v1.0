import { createContext, useContext } from 'react';

const SceneContext = createContext({ orbitControlsRef: null });

export const useSceneContext = () => useContext(SceneContext);
export default SceneContext;
