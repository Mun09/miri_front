export interface DocumentReview {
    law_name: string;
    key_clause: string;
    status: 'Prohibited' | 'Permitted' | 'Conditional' | 'Neutral' | 'Ambiguous';
    summary: string;
    url?: string;
}

export interface RiskReport {
    verdict: 'Review Required' | 'Safe' | 'Caution' | 'Danger';
    summary: string;
    key_issues: string[];
    citation?: string;
}

export interface AtomicAction {
    actor: string;
    action: string;
    object: string;
}

export interface Scenario {
    name: string;
    type: string;
    actions: AtomicAction[];
}

export interface ReferenceItem {
    title: string;
    url: string;
}

export interface AnalysisResult {
    business_model: any;
    scenario: Scenario;
    evidence: DocumentReview[];
    verdict: RiskReport;
    references: ReferenceItem[];
}
