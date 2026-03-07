export interface StepGuidance {
  headline: string;
  discussionPrompts: string[];
  qualityChecks: string[];
  nextActions: string[];
  source: "llm" | "fallback";
  generatedAt: string;
}

export interface WorkflowState {
  completed: Record<string, boolean>;
  notes: Record<string, string>;
  step1TopEvent?: string;
  guidanceByStep?: Record<string, StepGuidance>;
  lastActiveStepId?: number | null;
}
