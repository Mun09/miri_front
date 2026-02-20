export interface ActionItem {
    step_name: string;
    required_documents: string[];
    submission_agency: string;
    context: string;
}

export interface RoadmapStep {
    phase: number;
    title: string;
    estimated_time: string;
    description: string;
    action_items: ActionItem[];
}

export interface RiskEvaluation {
    score: 'Red' | 'Yellow' | 'Green' | string;
    rationale: string;
    key_hurdles: string[];
}

export interface WhatIfTrigger {
    variable_name: string;
    description: string;
    is_active: boolean;
}

export interface CrossDomainMapping {
    source_domain: string;
    target_domain: string;
    agency_mapping: string;
    law_mapping: string;
    key_differences: string;
}

export interface ReferenceItem {
    title: string;
    url: string;
}

export interface AnalysisResult {
    business_model: any;
    what_ifs: WhatIfTrigger[];
    cross_domains: CrossDomainMapping[];
    roadmap: RoadmapStep[];
    risk_evaluation: RiskEvaluation;
    references?: ReferenceItem[];
}
