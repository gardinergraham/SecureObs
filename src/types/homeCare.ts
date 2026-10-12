export type HomeCareProfile = {
    id: string;
    siteId: string;
    name: string;
    address: string | null;
    accessNotes: string | null;
    emergencyContact: string | null;
    careSummary: string | null;
    requiredCarers: number | null;
    continuousCover: boolean | null;
    updatedAt: string | null;
    canManage: boolean;
};
export type HomeCareDuty = {
    id: string;
    ward_id: string;
    staff_id: string;
    staff_name: string;
    kind: 'day' | 'waking_night' | 'sleep_in' | 'live_in' | 'wellness';
    starts_at: string;
    ends_at: string;
    notes: string;
    state: 'planned' | 'present' | 'break' | 'completed' | 'cancelled';
    checked_in_at: string | null;
    checked_out_at: string | null;
    updated_at: string;
};
export type HomeCareEvent = {
    id: string;
    duty_id: string;
    actor_name: string;
    action: string;
    notes: string;
    wellness_outcome?: string;
    recorded_at: string;
};
export type HomeCareSnapshot = {
    tasks: {
        wardId: string;
        outstanding: number;
        overdue: number;
    }[];
    patients: {
        id: string;
        wardId: string;
        firstName: string;
        surname: string;
    }[];
    homes: HomeCareProfile[];
    duties: HomeCareDuty[];
    events: HomeCareEvent[];
    serverTime: string;
};

export type HomeCareIntake = {
 id:string;siteId:string;name:string;address:string;
 accessNotes:string;emergencyContact:string;careSummary:string;
 requiredCarers:number;continuousCover:boolean;
 patient?:{roomNumber?:number;firstName:string;surname:string;reference:string;dateOfBirth:string;nextOfKinName:string;nextOfKinRelationship:string;nextOfKinTelephone:string;nextOfKinEmail:string};
};
