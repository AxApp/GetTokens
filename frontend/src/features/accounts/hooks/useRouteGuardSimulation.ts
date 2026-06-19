import { useCallback, useState } from 'react';
import { SimulateRouteGuardRule } from '../../../../wailsjs/go/main/App';
import type { RouteGuardSimulationRequest } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { normalizeSimulationResult, type SimulationResult } from '../model/routeGuardSimulation';
import type { TrackRequest } from '../model/types';

export default function useRouteGuardSimulation(trackRequest: TrackRequest) {
  const [lastSimulationResult, setLastSimulationResult] = useState<SimulationResult | null>(null);

  const simulateRouteGuardRule = useCallback(
    async (request: RouteGuardSimulationRequest) => {
      if (!hasWailsAppBindings()) {
        throw new Error('无法模拟当前规则：Wails 绑定不可用，不能据此认为规则安全。');
      }
      const result = normalizeSimulationResult(
        await trackRequest('SimulateRouteGuardRule', { accountKey: request.facts?.accountId }, () =>
          SimulateRouteGuardRule(request),
        ),
      );
      setLastSimulationResult(result);
      return result;
    },
    [trackRequest],
  );

  return {
    lastSimulationResult,
    simulateRouteGuardRule,
    setLastSimulationResult,
  };
}
