import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { normalizePipelineStages, buildStageMap, DEFAULT_PIPELINE_STAGES } from "@/components/crm/pipeline";

export default function usePipelineConfig() {
  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-settings"],
    queryFn: () => base44.functions.invoke("getPipelineSettings", {}).then((r) => r.data),
    staleTime: 60_000,
  });

  const allStages = useMemo(
    () => normalizePipelineStages(data?.stages || DEFAULT_PIPELINE_STAGES),
    [data]
  );

  const stageMap = useMemo(() => buildStageMap(allStages), [allStages]);
  const activeStages = useMemo(() => allStages.filter((stage) => stage.is_active), [allStages]);

  const getAllowedTargets = (currentStageKey) => {
    const currentStage = stageMap[currentStageKey] || stageMap.new_inquiry;
    return allStages.filter((stage) => (currentStage?.allowed_next_stages || []).includes(stage.key) && (stage.is_active || stage.key === currentStageKey));
  };

  return {
    isLoading,
    allStages,
    stages: activeStages,
    stageMap,
    getAllowedTargets,
  };
}