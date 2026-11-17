export interface WeekPeriod {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  monthKey: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleCode: 'CAPSU' | 'DEPUTI' | 'ADMIN' | 'BENDAHARA' | 'MEMBER' | string;
  roleName: string;
  jabatan: string;
  bio: string;
  avatarUrl: string;
  additionalInfo: string;
  status: string;
  privacyShowJoined: boolean;
  privacyShowDonations: boolean;
  joinedAt: string | null;
  permissions: string[];
}

export interface PublicLeader {
  id: string;
  fullName: string;
  username: string;
  roleCode: string;
  roleName: string;
  jabatan: string;
  bio: string;
  avatarUrl: string;
}

export interface CommunityInfo {
  platformName: string;
  fullName: string;
  tagline: string;
  secondaryTagline: string;
  philosophy: string;
  vision: string;
  mission: string[];
  rules: string[];
  contactEmail: string;
  retentionPolicy: string;
}

export interface PublicOverview {
  community: CommunityInfo;
  leadership: PublicLeader[];
  activeMembersCount: number;
  currentJakartaWeek: WeekPeriod;
}

export interface NotificationItem {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  link_tab: string;
  is_read: number;
  created_at: string;
}

export interface DonationTransaction {
  id: string;
  txCode: string;
  memberId: string;
  memberName: string;
  memberUsername: string;
  amountCoins: number;
  donationDate: string;
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  monthKey: string;
  notes: string;
  recordedAt: string;
}

export interface DonationTransparencyResponse {
  currentWeek: WeekPeriod;
  currentMonth: string;
  totals: {
    currentWeekTotal: number;
    currentMonthTotal: number;
    allTimeTotal: number;
    transactionCount: number;
  };
  weeklyHistory: Array<{
    weekKey: string;
    weekStart: string;
    weekEnd: string;
    totalCoins: number;
    txCount: number;
  }>;
  monthlyHistory: Array<{
    monthKey: string;
    totalCoins: number;
    txCount: number;
  }>;
  memberRecap: Array<{
    memberId: string;
    memberName: string;
    memberUsername: string;
    memberAvatar: string;
    currentWeekCoins: number;
    currentMonthCoins: number;
    allTimeCoins: number;
    txCount: number;
  }>;
  transactions: DonationTransaction[];
}

export type DashboardTab =
  | 'overview'
  | 'profile'
  | 'directory'
  | 'donations'
  | 'my-donations'
  | 'events'
  | 'announcements'
  | 'organization'
  | 'rules'
  | 'settings'
  | 'treasurer'
  | 'registrations'
  | 'members-admin'
  | 'roles-admin'
  | 'audit-logs'
  | 'community-settings';
