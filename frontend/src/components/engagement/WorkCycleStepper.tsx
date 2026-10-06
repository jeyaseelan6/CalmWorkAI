"use client";

import React from "react";
import { CheckCircle2, Circle, ArrowRight, Lightbulb, Target, Cpu, ShieldCheck, Rocket, Award } from "lucide-react";

export interface WorkCycleStepItem {
  stepNumber: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const WORK_CYCLE_STEPS: WorkCycleStepItem[] = [
  {
    stepNumber: 1,
    title: "Understand Business Reality",
    description: "Ground engagement in stakeholder context & customer reality",
    icon: Lightbulb
  },
  {
    stepNumber: 2,
    title: "Define the Right Problem",
    description: "Establish outcome, success criteria & DoD alignment",
    icon: Target
  },
  {
    stepNumber: 3,
    title: "Design the AI Approach",
    description: "Map agent capabilities, RAG pipelines & privacy guardrails",
    icon: Cpu
  },
  {
    stepNumber: 4,
    title: "Build Within Real Constraints",
    description: "Technical integration, security/SSO & data rules",
    icon: ShieldCheck
  },
  {
    stepNumber: 5,
    title: "Deploy Into Production",
    description: "Production validation, cutover execution & deployment",
    icon: Rocket
  },
  {
    stepNumber: 6,
    title: "Own Outcomes & Improve",
    description: "Continuous health monitoring & change impact reasoning",
    icon: Award
  }
];

interface WorkCycleStepperProps {
  currentStepNumber: number; // 1 to 6
  customerName: string;
}

export default function WorkCycleStepper({
  currentStepNumber = 4,
  customerName = "Acme Corp"
}: WorkCycleStepperProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400">
            FDE Engagement Work Cycle
          </h3>
          <p className="text-xs text-slate-300 font-medium mt-0.5">
            Managing <span className="text-slate-100 font-bold">{customerName}</span> through 6 structured outcome cycles
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30 font-semibold">
          Active: Step {currentStepNumber} of 6
        </span>
      </div>

      {/* Stepper Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
        {WORK_CYCLE_STEPS.map((step) => {
          const Icon = step.icon;
          const isCompleted = step.stepNumber < currentStepNumber;
          const isCurrent = step.stepNumber === currentStepNumber;
          const isUpcoming = step.stepNumber > currentStepNumber;

          return (
            <div
              key={step.stepNumber}
              className={`p-3 rounded-lg border text-left transition-all ${
                isCurrent
                  ? "bg-slate-950 border-teal-500/60 ring-1 ring-teal-500/30 shadow-md"
                  : isCompleted
                  ? "bg-slate-950/60 border-slate-800/80 opacity-90"
                  : "bg-slate-950/30 border-slate-900 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                  isCurrent
                    ? "bg-teal-500 text-slate-950"
                    : isCompleted
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-400"
                }`}>
                  STEP {step.stepNumber}
                </span>
                {isCompleted ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : isCurrent ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                  </span>
                ) : (
                  <Circle className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                )}
              </div>

              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${
                  isCurrent ? "text-teal-400" : isCompleted ? "text-emerald-400" : "text-slate-500"
                }`} />
                <h4 className={`text-xs font-semibold line-clamp-1 ${
                  isCurrent ? "text-slate-100" : isCompleted ? "text-slate-300" : "text-slate-400"
                }`}>
                  {step.title}
                </h4>
              </div>

              <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
